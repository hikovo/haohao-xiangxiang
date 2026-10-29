import UIKit
import WebKit

/// Native material over the web view, with the same four actions and approved artwork.
final class NativeGlassDock: NSObject, WKScriptMessageHandler {
  private weak var webview: WKWebView?
  private var material: UIVisualEffectView?
  private var buttons: [UIButton] = []
  private var labels: [UILabel] = []
  private var images: [UIImageView] = []
  private let pages = ["home", "chat", "memo", "profile"]
  private let titles = ["首页", "说说话", "备忘录", "我的"]
  private var artworkReady = false
  private var acknowledged = false
  private var latestLayout: [String: Any]?
  private var tintPage: String?
  private var scrollObservation: NSKeyValueObservation?
  private var nativeScrollArmed = false
  private var nativeGestureTime: TimeInterval = -.infinity
  private var nativeOffset: CGFloat = 0
  private let scrollBlur = NativeScrollBlur()
  #if DEBUG
  private var dockChecks: [[String: Any]] = []
  #endif

  func attach(to webview: WKWebView) {
    self.webview = webview
    webview.scrollView.showsVerticalScrollIndicator = false
    webview.scrollView.showsHorizontalScrollIndicator = false
    scrollBlur.attach(to: webview)
    webview.overrideUserInterfaceStyle = .light
    if #available(iOS 26.0, *) {
      // Native container uses Apple's soft scroll edges; DOM scrollers use the
      // public UIKit material in NativeScrollBlur, not a CSS content mask.
      webview.scrollView.topEdgeEffect.style = .soft
      webview.scrollView.bottomEdgeEffect.style = .soft
      webview.scrollView.topEdgeEffect.isHidden = true
      webview.scrollView.bottomEdgeEffect.isHidden = true
      webview.scrollView.panGestureRecognizer.addTarget(self, action: #selector(nativeScrollGesture(_:)))
      scrollObservation = webview.scrollView.observe(\.contentOffset, options: [.new]) { [weak self] scroll, _ in
        guard let self else { return }
        let offset = scroll.contentOffset.y + scroll.adjustedContentInset.top
        let maximum = max(0, scroll.contentSize.height + scroll.adjustedContentInset.top + scroll.adjustedContentInset.bottom - scroll.bounds.height)
        if abs(offset - self.nativeOffset) > 0.5 && ProcessInfo.processInfo.systemUptime - self.nativeGestureTime < 2 { self.nativeScrollArmed = true }
        self.nativeOffset = offset
        // DOM scroll regions own the page/state rules. The outer WKScrollView
        // must not add a second edge when a keyboard or dialog changes its size.
        scroll.topEdgeEffect.isHidden = true
        scroll.bottomEdgeEffect.isHidden = true
      }
    }
    webview.configuration.userContentController.add(self, name: "sanhaoGlass")
    #if DEBUG
    if ProcessInfo.processInfo.environment["SANHAO_GLASS_CHECK"] == "1" {
      DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
        guard let self, let webview = self.webview else { return }
        webview.evaluateJavaScript("JSON.stringify({bridge:typeof window.webkit?.messageHandlers?.sanhaoGlass,connecting:document.documentElement.dataset.glassConnecting,ready:document.documentElement.classList.contains('native-glass-ready'),dock:document.querySelector('.mobile-dock')?.getBoundingClientRect().toJSON(),viewport:innerWidth,url:location.href})") { value, error in
          let report: [String: Any] = ["artworkReady": self.artworkReady, "material": self.material != nil,
            "hidden": self.material?.isHidden ?? true, "layout": self.latestLayout ?? [:], "web": value ?? "", "error": error.map(String.init(describing:)) ?? ""]
          if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
            let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("glass-check.json")
            try? data.write(to: url, options: .atomic)
          }
        }
      }
    }
    #endif
  }

  @objc private func nativeScrollGesture(_ gesture: UIPanGestureRecognizer) {
    if gesture.state == .began || gesture.state == .changed { nativeGestureTime = ProcessInfo.processInfo.systemUptime }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.frameInfo.isMainFrame, let value = message.body as? [String: Any],
      let kind = value["kind"] as? String else { return }
    if kind == "scrollEdges" {
      scrollBlur.apply(value, below: material)
      return
    }
    if kind == "hide" {
      material?.isHidden = true
      acknowledged = false
      webview?.evaluateJavaScript("document.documentElement.classList.remove('native-glass-ready')", completionHandler: nil)
      return
    }
    if kind == "icons" {
      guard let icons = value["icons"] as? [[String: String]], icons.count == 4 else { return }
      var decoded: [UIImage] = []
      for page in pages {
        guard let encoded = icons.first(where: { $0["page"] == page })?["data"], encoded.count < 2_000_000,
          let data = Data(base64Encoded: encoded), let image = UIImage(data: data) else { return }
        decoded.append(image)
      }
      createMaterialIfNeeded()
      for (index, image) in decoded.enumerated() { images[index].image = image }
      acknowledged = false // A reloaded document must receive its own readiness acknowledgement.
      artworkReady = true
      if let layout = latestLayout { apply(layout) }
    } else if kind == "layout" {
      latestLayout = value
      apply(value)
    }
  }

  private func createMaterialIfNeeded() {
    guard material == nil, let webview else { return }
    let effect: UIVisualEffect
    if #available(iOS 26.0, *) {
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = true
      effect = glass
    } else {
      effect = UIBlurEffect(style: .systemThinMaterialLight)
    }
    let view = UIVisualEffectView(effect: effect)
    view.overrideUserInterfaceStyle = .light
    view.accessibilityIdentifier = "sanhao.native-glass-dock"
    view.layer.cornerRadius = 18
    view.clipsToBounds = true
    view.isHidden = true
    webview.addSubview(view)
    material = view
    if #available(iOS 26.0, *) {
      let interaction = UIScrollEdgeElementContainerInteraction()
      interaction.scrollView = webview.scrollView
      interaction.edge = .bottom
      view.addInteraction(interaction)
    }
    for (index, title) in titles.enumerated() {
      let button = UIButton(type: .custom)
      button.tag = index
      button.layer.cornerRadius = 12
      button.accessibilityLabel = title
      button.accessibilityIdentifier = "sanhao.nav.\(pages[index])"
      button.addTarget(self, action: #selector(navigate(_:)), for: .touchUpInside)
      let image = UIImageView()
      image.contentMode = .scaleAspectFit
      image.isUserInteractionEnabled = false
      let label = UILabel()
      label.text = title
      label.font = .systemFont(ofSize: 13, weight: .medium)
      label.textAlignment = .center
      label.isUserInteractionEnabled = false
      button.addSubview(image)
      button.addSubview(label)
      view.contentView.addSubview(button)
      buttons.append(button); images.append(image); labels.append(label)
    }
  }

  private func apply(_ value: [String: Any]) {
    guard artworkReady, let view = material, let webview else { return }
    #if DEBUG
    defer {
      if ProcessInfo.processInfo.environment["SANHAO_DOCK_CHECK"] == "1" {
        dockChecks.append(["layout": value, "hidden": view.isHidden,
          "frame": ["x": view.frame.minX, "y": view.frame.minY, "width": view.frame.width, "height": view.frame.height]])
        if dockChecks.count > 100 { dockChecks.removeFirst() }
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("modal-dock-native.json")
        if let data = try? JSONSerialization.data(withJSONObject: dockChecks, options: [.prettyPrinted, .sortedKeys]) { try? data.write(to: url, options: .atomic) }
      }
    }
    #endif
    guard value["visible"] as? Bool == true else { view.isHidden = true; return }
    func number(_ key: String) -> CGFloat? {
      guard let number = value[key] as? NSNumber, number.doubleValue.isFinite else { return nil }
      return CGFloat(number.doubleValue)
    }
    guard let x = number("x"), let y = number("y"), let width = number("width"),
      let height = number("height"), let viewportWidth = number("viewportWidth"),
      viewportWidth > 0, width > 100, height >= 60 else { view.isHidden = true; return }
    let scale = webview.bounds.width / viewportWidth
    let bottom = min(40, max(8, number("bottom") ?? 8))
    let frame = CGRect(x: (x + 18) * scale, y: (y + 4) * scale,
      width: (width - 36) * scale, height: min(76, height - bottom) * scale)
    guard frame.minY >= 0, frame.maxY <= webview.bounds.height + 1 else { view.isHidden = true; return }
    view.frame = frame
    let selected = value["selected"] as? String ?? "home"
    if selected != tintPage, #available(iOS 26.0, *) {
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = true
      glass.tintColor = selected == "chat"
        ? UIColor(red: 1, green: 245/255, blue: 246/255, alpha: 0.35)
        : UIColor(red: 1, green: 253/255, blue: 248/255, alpha: 0.2)
      view.effect = glass
      tintPage = selected
    }
    let itemWidth = (frame.width - 12 * scale) / 4
    for index in pages.indices {
      let active = pages[index] == selected
      let button = buttons[index]
      button.frame = CGRect(x: 6 * scale + CGFloat(index) * itemWidth, y: 5 * scale,
        width: itemWidth, height: frame.height - 10 * scale)
      button.backgroundColor = active ? UIColor(red: 252/255, green: 239/255, blue: 241/255, alpha: 0.72) : .clear
      button.accessibilityTraits = active ? [.button, .selected] : [.button]
      let contentTop = (button.bounds.height - 54 * scale) / 2
      images[index].frame = CGRect(x: (itemWidth - 32 * scale) / 2, y: contentTop, width: 32 * scale, height: 32 * scale)
      labels[index].frame = CGRect(x: 0, y: contentTop + 37 * scale, width: itemWidth, height: 17 * scale)
      labels[index].textColor = active ? UIColor(red: 103/255, green: 77/255, blue: 82/255, alpha: 1) : UIColor(red: 155/255, green: 124/255, blue: 129/255, alpha: 1)
    }
    view.isHidden = false
    webview.bringSubviewToFront(view)
    if !acknowledged {
      acknowledged = true
      webview.evaluateJavaScript("document.documentElement.classList.add('native-glass-ready')", completionHandler: nil)
    }
  }

  @objc private func navigate(_ button: UIButton) {
    guard pages.indices.contains(button.tag), let webview else { return }
    // The page name comes only from this fixed list; existing page handlers own state and haptics.
    let page = pages[button.tag]
    webview.evaluateJavaScript("document.querySelector('[data-nav=\"\(page)\"]')?.click()", completionHandler: nil)
  }
}
