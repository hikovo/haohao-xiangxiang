import AVFoundation
import AVKit
import UIKit
import WebKit

struct RabbitOverlayArgs: Decodable {
  var working: Bool?
  var scale: Double?
  var atlas: String?
}

/// A custom transparent view source, not an AVPlayerLayer. AVKit still owns
/// window chrome and compositing; alpha-through requires physical-device QA.
final class RabbitPictureInPicture: NSObject, AVPictureInPictureControllerDelegate {
  weak var webview: WKWebView?
  private var controller: AVPictureInPictureController?
  private var content: AVPictureInPictureVideoCallViewController?
  private var rabbit: UIImageView?
  private var preview: UIView?
  private var frames: [[UIImage]] = []
  private var possibility: NSKeyValueObservation?
  private var timeout: DispatchWorkItem?
  private var pendingStart: ((Result<String, Error>) -> Void)?
  private var pendingStop: (() -> Void)?
  private var starting = false
  private var requested = false
  private var working = false
  private var scale = 0.6
  private var previousAudio: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?

  var status: String { controller?.isPictureInPictureActive == true ? "active" : starting ? "starting" : "inactive" }
  var snapshot: String { "{\"working\":\(working),\"scale\":\(scale)}" }
  private func error(_ text: String) -> NSError { NSError(domain: "RabbitPiP", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }

  private func decodeAtlas(_ encoded: String?) throws {
    guard let encoded, encoded.count < 4_000_000, let data = Data(base64Encoded: encoded),
      let atlas = UIImage(data: data)?.cgImage, atlas.width == 1536, atlas.height == 1872 else {
      throw error("兔兔动画还没准备好，请重新开启")
    }
    frames = try (0..<9).map { row in
      try (0..<8).map { column in
        guard let frame = atlas.cropping(to: CGRect(x: column * 192, y: row * 208, width: 192, height: 208)) else {
          throw error("兔兔图集读取失败")
        }
        return UIImage(cgImage: frame)
      }
    }
  }

  private func animate() {
    guard let rabbit, frames.count == 9 else { return }
    rabbit.stopAnimating()
    var sequence: [UIImage] = []
    if working {
      sequence = Array(frames[7].prefix(6))
    } else {
      // Idle, blink, smile and wave: the same rows used by the homepage rabbit.
      sequence += Array(repeating: frames[0][0], count: 36)
      sequence += Array(frames[0].prefix(6))
      sequence += Array(repeating: frames[0][0], count: 24)
      sequence += frames[1]
      sequence += Array(repeating: frames[0][0], count: 24)
      sequence += Array(frames[4].prefix(5))
    }
    rabbit.image = sequence.first
    rabbit.animationImages = sequence
    rabbit.animationDuration = Double(sequence.count) / 8
    rabbit.animationRepeatCount = 0
    rabbit.startAnimating()
  }

  func start(_ args: RabbitOverlayArgs, completion: @escaping (Result<String, Error>) -> Void) {
    guard AVPictureInPictureController.isPictureInPictureSupported() else {
      completion(.failure(error("这台设备暂不支持画中画陪伴；请使用真实 iPhone 测试"))); return
    }
    if status == "active" { update(args); completion(.success("active")); return }
    guard !starting else { completion(.failure(error("兔兔正在出来，稍等一下喔"))); return }
    guard let host = webview?.superview, host.window != nil else { completion(.failure(error("请回到 App 后再开启陪伴"))); return }
    do {
      try decodeAtlas(args.atlas)
      working = args.working ?? false
      scale = min(1.5, max(0.35, args.scale ?? 0.6))
      let audio = AVAudioSession.sharedInstance()
      previousAudio = (audio.category, audio.mode, audio.categoryOptions)
      try audio.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try audio.setActive(true)
      let source = UIImageView(image: frames[working ? 7 : 0][0])
      source.frame = CGRect(x: max(8, host.bounds.width - 128), y: max(host.safeAreaInsets.top + 8, host.bounds.height - host.safeAreaInsets.bottom - 240), width: 120, height: 130)
      source.contentMode = .scaleAspectFit
      source.backgroundColor = .clear
      source.isOpaque = false
      source.isUserInteractionEnabled = false
      source.autoresizingMask = [.flexibleLeftMargin, .flexibleTopMargin]
      host.addSubview(source)
      preview = source
      let content = AVPictureInPictureVideoCallViewController()
      content.preferredContentSize = CGSize(width: 192 * scale, height: 208 * scale)
      content.view.backgroundColor = .clear
      content.view.isOpaque = false
      content.view.layer.backgroundColor = UIColor.clear.cgColor
      let rabbit = UIImageView()
      rabbit.backgroundColor = .clear
      rabbit.isOpaque = false
      rabbit.contentMode = .scaleAspectFit
      rabbit.translatesAutoresizingMaskIntoConstraints = false
      content.view.addSubview(rabbit)
      NSLayoutConstraint.activate([
        rabbit.leadingAnchor.constraint(equalTo: content.view.leadingAnchor),
        rabbit.trailingAnchor.constraint(equalTo: content.view.trailingAnchor),
        rabbit.topAnchor.constraint(equalTo: content.view.topAnchor),
        rabbit.bottomAnchor.constraint(equalTo: content.view.bottomAnchor)
      ])
      self.content = content
      self.rabbit = rabbit
      animate()
      let sourceContent = AVPictureInPictureController.ContentSource(activeVideoCallSourceView: source, contentViewController: content)
      let pip = AVPictureInPictureController(contentSource: sourceContent)
      controller = pip
      pip.delegate = self
      pip.canStartPictureInPictureAutomaticallyFromInline = false
      starting = true
      requested = false
      pendingStart = completion
      possibility = pip.observe(\.isPictureInPicturePossible, options: [.initial, .new]) { [weak self] pip, _ in
        DispatchQueue.main.async {
          guard let self, self.starting, !self.requested, pip.isPictureInPicturePossible else { return }
          self.requested = true
          self.possibility = nil
          pip.startPictureInPicture()
        }
      }
      let timeout = DispatchWorkItem { [weak self] in
        guard let self, self.starting else { return }
        self.fail(self.error("画中画未能开启，请关闭其他小窗后重试"))
      }
      self.timeout = timeout
      DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: timeout)
    } catch { fail(error, fallback: completion) }
  }

  func update(_ args: RabbitOverlayArgs) {
    if let next = args.working, next != working { working = next; animate() }
    if let next = args.scale, next.isFinite {
      scale = min(1.5, max(0.35, next))
      content?.preferredContentSize = CGSize(width: 192 * scale, height: 208 * scale)
    }
  }
  func stop(completion: @escaping () -> Void) {
    if controller?.isPictureInPictureActive == true { pendingStop = completion; controller?.stopPictureInPicture() }
    else {
      let start = pendingStart; pendingStart = nil
      cleanup(); start?(.failure(error("已取消悬浮陪伴"))); completion()
    }
  }
  private func changed() { webview?.evaluateJavaScript("window.dispatchEvent(new Event('sanhao-overlay-changed'))", completionHandler: nil) }
  private func fail(_ error: Error, fallback: ((Result<String, Error>) -> Void)? = nil) {
    let callback = pendingStart ?? fallback; pendingStart = nil
    cleanup(); callback?(.failure(error)); changed()
  }
  private func cleanup() {
    timeout?.cancel(); timeout = nil; possibility = nil
    starting = false; requested = false
    rabbit?.stopAnimating(); rabbit?.animationImages = nil; rabbit = nil
    content = nil; frames = []
    preview?.removeFromSuperview(); preview = nil
    controller?.delegate = nil; controller = nil
    if let previous = previousAudio {
      let audio = AVAudioSession.sharedInstance()
      try? audio.setActive(false, options: .notifyOthersOnDeactivation)
      try? audio.setCategory(previous.0, mode: previous.1, options: previous.2)
      previousAudio = nil
    }
  }
  func pictureInPictureControllerDidStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
    timeout?.cancel(); timeout = nil; starting = false
    // No inline video or AVKit playback placeholder is left inside the app.
    if let preview { preview.frame.origin.x = -(preview.frame.width + 8) }
    let callback = pendingStart; pendingStart = nil; callback?(.success("active")); changed()
  }
  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, failedToStartPictureInPictureWithError error: Error) {
    fail(self.error("画中画没有开启：\(error.localizedDescription)"))
  }
  func pictureInPictureControllerDidStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
    let callback = pendingStop; pendingStop = nil; cleanup(); callback?(); changed()
  }
  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) { completionHandler(webview?.window != nil) }
}
