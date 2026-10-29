import Foundation
import BackgroundAssets
import CryptoKit
import System

private struct ModelResourceFile: Decodable {
  let name: String
  let packID: String
  let bytes: Int64
  let sha256: String
}
private struct ModelResourceManifest: Decodable {
  let packID: String
  let stylePackID: String
  let version: String
  let bytes: Int64
  let files: [ModelResourceFile]
}

// Model bytes are optional data managed by Apple, never executable downloads.
// Only a completely verified pack becomes visible to the native inference code.
@MainActor final class LocalModelAssets {
  static let shared = LocalModelAssets()
  private var task: Task<Void,Never>?
  private var observer: Task<Void,Never>?
  private var downloadProgress: Progress?
  private var state = "missing"
  private var fraction = 0.0
  private var received: Int64 = 0
  private var generation = 0
  private var manifest: ModelResourceManifest? {
    guard let url=Bundle.main.url(forResource:"ModelResourceManifest",withExtension:"json"),
          let bytes=try? Data(contentsOf:url) else { return nil }
    return try? JSONDecoder().decode(ModelResourceManifest.self,from:bytes)
  }
  private func installed() -> Bool {
    guard let paths=UserDefaults.standard.dictionary(forKey:"sanhao.localmodel.resources"),
          let base=paths["base"] as? String,let adapter=paths["adapter"] as? String else { return false }
    return [base,adapter].allSatisfy { FileManager.default.fileExists(atPath:$0) }
  }
  // Explicit direct-install builds may keep the selected signed resources
  // available while their Apple-hosted counterparts await publication.
  // Normal distribution builds contain neither of these files.
  private func bundled() -> Bool {
    ["LocalChat", "LocalChat-LoRA"].allSatisfy {
      Bundle.main.url(forResource:$0,withExtension:"gguf",subdirectory:"LocalModel") != nil
    }
  }
  func handle(_ operation: String) -> String {
    if operation == "download" { start() }
    if operation == "cancelDownload" {
      generation += 1
      downloadProgress?.cancel(); task?.cancel(); task=nil
      observer?.cancel(); observer=nil; state="paused"
    }
    if task == nil && !installed() && bundled() {
      state="ready";fraction=1
    } else if task == nil && installed() {
      let version=UserDefaults.standard.dictionary(forKey:"sanhao.localmodel.resources")?["version"] as? String
      state=version==manifest?.version ? "ready" : "update";fraction=1
    } else if operation=="assetStatus",state=="missing",task == nil, #available(iOS 26.4,*),let manifest,
      AssetPackManager.shared.assetPackIsAvailableLocally(withID:manifest.packID),
      AssetPackManager.shared.assetPackIsAvailableLocally(withID:manifest.stylePackID) {
      // Recover an already downloaded pack after the app was terminated. This
      // branch never requests an absent pack or starts a first download.
      start()
    }
    if #unavailable(iOS 26.0), !bundled() { state="unsupported" }
    let value:[String:Any] = ["status":state,"progress":fraction,
      "receivedBytes":received,"totalBytes":manifest?.bytes ?? 0,
      "installed":installed() || bundled(),"source":installed() ? "apple" : bundled() ? "bundle" : "apple"]
    return String(decoding:(try? JSONSerialization.data(withJSONObject:value)) ?? Data(),as:UTF8.self)
  }
  private func start() {
    guard task == nil else { return }
    guard #available(iOS 26.0,*), let manifest else { state="unsupported";return }
    generation += 1
    let run=generation
    state="downloading"
    task=Task { [weak self] in
      do {
        let manager=AssetPackManager.shared
        var completedBytes:Int64=0
        for packID in [manifest.packID,manifest.stylePackID] {
          try Task.checkCancellation()
          let packBytes=manifest.files.filter{$0.packID==packID}.reduce(Int64(0)){$0+$1.bytes}
          let priorBytes=completedBytes
          self?.observer=Task { [weak self] in
            for await update in manager.statusUpdates(forAssetPackWithID:packID) {
              guard !Task.isCancelled,self?.generation==run else { break }
              switch update {
              case .downloading(_,let progress):
                self?.downloadProgress=progress
                let bytes=priorBytes+Int64(Double(packBytes)*max(0,min(1,progress.fractionCompleted)))
                self?.received=bytes
                self?.fraction=Double(bytes)/Double(manifest.bytes)
                self?.state="downloading"
              case .paused: self?.state="paused"
              case .failed: self?.state="failed"
              default: break
              }
            }
          }
          let pack=try await manager.assetPack(withID:packID)
          try await manager.ensureLocalAvailability(of:pack)
          self?.observer?.cancel();self?.observer=nil
          completedBytes += packBytes
        }
        try Task.checkCancellation()
        guard self?.generation==run else { return }
        self?.state="verifying";self?.fraction=1
        let urls=try manifest.files.map { try manager.url(for:FilePath("LocalModel/\($0.name)")) }
        // Stream hashes; a multi-GB weight must never be read into one Data.
        let verification=Task.detached(priority:.utility) {
          for (file,url) in zip(manifest.files,urls) {
            let values=try url.resourceValues(forKeys:[.fileSizeKey,.isRegularFileKey])
            guard values.isRegularFile == true,Int64(values.fileSize ?? -1)==file.bytes else { throw CocoaError(.fileReadCorruptFile) }
            let handle=try FileHandle(forReadingFrom:url);defer { try? handle.close() }
            var hash=SHA256()
            while let part=try handle.read(upToCount:1_048_576),!part.isEmpty {
              try Task.checkCancellation();hash.update(data:part)
            }
            guard hash.finalize().map({String(format:"%02x",$0)}).joined()==file.sha256 else { throw CocoaError(.fileReadCorruptFile) }
          }
        }
        try await withTaskCancellationHandler {
          try await verification.value
        } onCancel: {
          verification.cancel()
        }
        try Task.checkCancellation()
        guard let base=zip(manifest.files,urls).first(where:{$0.0.name=="LocalChat.gguf"})?.1.path,
              let adapter=zip(manifest.files,urls).first(where:{$0.0.name=="LocalChat-LoRA.gguf"})?.1.path else { throw CocoaError(.fileNoSuchFile) }
        UserDefaults.standard.set(["base":base,"adapter":adapter,"version":manifest.version],forKey:"sanhao.localmodel.resources")
        self?.state="ready";self?.fraction=1
      } catch { if self?.generation==run {self?.state=Task.isCancelled ? "paused" : "failed"} }
      guard self?.generation==run else { return }
      self?.observer?.cancel();self?.observer=nil;self?.downloadProgress=nil;self?.task=nil
    }
  }
}
