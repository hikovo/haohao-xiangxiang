import UIKit
import WebKit

/// Public UIKit material for DOM scroll boundaries. The web layer sends only
/// geometry; the live backdrop is sampled and blurred by UIVisualEffectView.
final class NativeScrollBlur {
  private weak var webview: WKWebView?
  private var edges: [String: UIVisualEffectView] = [:]

  func attach(to webview: WKWebView) { self.webview = webview }

  func apply(_ payload: [String: Any], below dock: UIView?) {
    guard let webview else { return }
    guard let viewport = finite(payload["viewportWidth"]), viewport > 0,
      let regions = payload["regions"] as? [[String: Any]], regions.count <= 12 else {
      clear(); return
    }
    let scale = webview.bounds.width / viewport
    var used = Set<String>()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for region in regions {
      guard let id = region["id"] as? String, id.range(of: "^e[0-9]{1,8}$", options: .regularExpression) != nil,
        let x = finite(region["x"]), let y = finite(region["y"]),
        let width = finite(region["width"]), let height = finite(region["height"]),
        let depth = finite(region["depth"]),
        width > 0, height > 0, depth > 0 else { continue }
      let bounds = CGRect(x: x * scale, y: y * scale, width: width * scale, height: height * scale)
      // A clipping ancestor or keyboard must never push a band outside the viewport.
      let clipped = bounds.intersection(webview.bounds)
      guard !clipped.isNull, clipped.height >= depth * scale * 2,
        bounds.minY >= webview.bounds.minY - 1, bounds.maxY <= webview.bounds.maxY + 1 else { continue }
      for top in [true, false] {
        let strength = finite(region[top ? "top" : "bottom"]) ?? 0
        guard strength > 0 else { continue }
        let key = id + (top ? ".top" : ".bottom")
        used.insert(key)
        let view: UIVisualEffectView
        if let existing = edges[key] { view = existing }
        else {
          view = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterialLight))
          view.overrideUserInterfaceStyle = .light
          view.isUserInteractionEnabled = false
          view.accessibilityElementsHidden = true
          view.accessibilityIdentifier = "sanhao.native-scroll-blur." + key
          view.backgroundColor = .clear
          if let dock { webview.insertSubview(view, belowSubview: dock) }
          else { webview.addSubview(view) }
          edges[key] = view
        }
        let dockEdge = !top && region["dock"] as? Bool == true
        let requestedDepth = top ? depth : (finite(region["bottomDepth"]) ?? depth)
        let edgeDepth = min(requestedDepth * scale, clipped.height / 2)
        view.frame = CGRect(x: clipped.minX, y: top ? clipped.minY : clipped.maxY - edgeDepth,
          width: clipped.width, height: edgeDepth)
        // Fade the material's coverage, not the content or a colored film. Keep
        // the effect view itself at alpha 1, as required by UIKit's blur renderer.
        let mask = view.mask ?? UIView()
        mask.frame = view.bounds
        let gradient = (mask.layer.sublayers?.first as? CAGradientLayer) ?? CAGradientLayer()
        if gradient.superlayer == nil { mask.layer.addSublayer(gradient) }
        gradient.frame = mask.bounds
        let opacity = min(1, max(0, strength))
        let levels: [CGFloat] = top ? [1, 0.92, 0.55, 0] : [0, 0.55, 1, 1]
        gradient.colors = levels.map { UIColor.black.withAlphaComponent($0 * opacity).cgColor }
        let endpoint = dockEdge ? min(1, 44 * scale / edgeDepth) : 1
        gradient.locations = top ? [0, 0.35, 0.7, 1] : [0, NSNumber(value: Double(endpoint * 0.45)), NSNumber(value: Double(endpoint)), 1]
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1)
        view.mask = mask
        // Real UIKit backdrop blur first, then the same paper color resolves
        // gradually at icon height. No hard boundary or standalone opaque band.
        let paper = (view.contentView.layer.sublayers?.first { $0.name == "paper-endpoint" } as? CAGradientLayer) ?? CAGradientLayer()
        paper.name = "paper-endpoint"
        if paper.superlayer == nil { view.contentView.layer.addSublayer(paper) }
        paper.frame = view.bounds
        if let rgb = region["paper"] as? [NSNumber], rgb.count == 3 {
          let color = UIColor(red: CGFloat(min(255, max(0, rgb[0].doubleValue)) / 255),
            green: CGFloat(min(255, max(0, rgb[1].doubleValue)) / 255),
            blue: CGFloat(min(255, max(0, rgb[2].doubleValue)) / 255), alpha: 1)
          let paperLevels: [CGFloat] = top ? [1, 0.85, 0.08, 0] : [0, 0.08, 1, 1]
          paper.colors = paperLevels.map { color.withAlphaComponent($0 * opacity).cgColor }
          paper.locations = top ? [0, 0.2, 0.65, 1] : [0, NSNumber(value: Double(endpoint * 0.45)), NSNumber(value: Double(endpoint)), 1]
          paper.startPoint = CGPoint(x: 0.5, y: 0); paper.endPoint = CGPoint(x: 0.5, y: 1)
        } else { paper.colors = nil }
      }
    }
    for key in Array(edges.keys) where !used.contains(key) {
      edges.removeValue(forKey: key)?.removeFromSuperview()
    }
    CATransaction.commit()
    if let dock { webview.bringSubviewToFront(dock) }
  }

  private func clear() {
    for view in edges.values { view.removeFromSuperview() }
    edges.removeAll()
  }
  private func finite(_ value: Any?) -> CGFloat? {
    guard let number = value as? NSNumber, number.doubleValue.isFinite else { return nil }
    return CGFloat(number.doubleValue)
  }
}
