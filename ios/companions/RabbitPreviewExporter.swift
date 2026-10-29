#if DEBUG
import SwiftUI
import WidgetKit
import UIKit

@available(iOS 17.0, *)
@MainActor enum RabbitPreviewExporter {
  private static var exported = false
  static func export() {
    guard !exported else { return }; exported = true
    do {
      let state = try RabbitStore.read()
      let date = Date()
      let entry = RabbitEntry(date: date, state: state, shared: RabbitStore.sharedAvailable, failed: false)
      let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("RabbitWidgetPreviews")
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      // Device diagnostics distinguish a rendered SwiftUI preview from a real
      // WidgetKit configuration/timeline. No record text is written here.
      let statusFile = folder.appendingPathComponent("companion-health.json")
      let basic: [String: Any] = ["bundle": Bundle.main.bundleIdentifier ?? "", "sharedEnabled": Bundle.main.object(forInfoDictionaryKey: "RabbitSharedRecordsEnabled") as? Bool ?? false, "sharedAvailable": RabbitStore.sharedAvailable, "groupDirectory": RabbitStore.directory.path]
      WidgetCenter.shared.getCurrentConfigurations { result in
        var health = basic
        health["liveStyle"] = ["background": state.liveStyle.background, "bubble": state.liveStyle.bubble, "buttons": state.liveStyle.buttons]
        if let bytes = try? Data(contentsOf: RabbitStore.directory.appendingPathComponent("small-widget-health.json")), let small = try? JSONSerialization.jsonObject(with: bytes) { health["smallProvider"] = small }
        switch result {
        case .success(let widgets): health["widgets"] = widgets.map { ["kind": $0.kind, "family": String(describing: $0.family)] }
        case .failure(let error): health["widgetError"] = error.localizedDescription
        }
        if let bytes = try? JSONSerialization.data(withJSONObject: health, options: .sortedKeys) { try? bytes.write(to: statusFile, options: .atomic) }
      }
      func save<V: View>(_ view: V, name: String, width: CGFloat, height: CGFloat) throws {
        let renderer = ImageRenderer(content: view.frame(width: width, height: height).background(Color(red: 1, green: 249/255, blue: 239/255)).clipShape(RoundedRectangle(cornerRadius: 22)))
        renderer.scale = 3
        guard let image = renderer.uiImage, let bytes = image.pngData() else { throw CocoaError(.fileWriteUnknown) }
        try bytes.write(to: folder.appendingPathComponent(name + ".png"))
      }
      for width: CGFloat in [280, 320, 393] {
        try save(RabbitLiveCard(mood: "wink", message: "今天吃：番茄鸡蛋面", style: state.liveStyle), name: "live-card-\(Int(width))", width: width, height: 130)
      }
      let islandRenderer = ImageRenderer(content: RabbitLiveCard(mood: "wink", message: "今天吃：番茄鸡蛋面", island: true, style: state.liveStyle)
        .frame(width: 300, height: 112).padding(12).background(Color.black).clipShape(RoundedRectangle(cornerRadius: 30)))
      islandRenderer.scale = 3
      if let image = islandRenderer.uiImage, let data = image.pngData() {
        try data.write(to: folder.appendingPathComponent("island-card-300.png"))
      }
      try save(RabbitSmallView(entry: entry), name: "small", width: 170, height: 170)
      for kind in [RabbitContent.todo, .anniversary, .countdown, .note, .moment] {
        let item = RabbitEntry(date: date, state: state, shared: entry.shared, failed: false, content: kind)
        try save(RabbitBoardView(entry: item, previewFamily: .systemMedium), name: "medium-" + kind.rawValue, width: 360, height: 170)
        let big = RabbitEntry(date: date, state: state, shared: entry.shared, failed: false, content: kind, secondary: kind == .note ? .moment : .note)
        try save(RabbitBoardView(entry: big, previewFamily: .systemLarge), name: "large-" + kind.rawValue, width: 360, height: 376)
      }
    } catch { print("Rabbit previews unavailable: \(error)") }
  }
}
#endif
