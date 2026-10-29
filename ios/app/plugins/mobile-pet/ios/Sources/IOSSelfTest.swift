#if DEBUG
import WebKit
import UIKit

// Runs only when an explicit environment flag is supplied by the local UI
// test runner. There is no command or HTTP endpoint for starting tests.
enum IOSSelfTest {
  static func probe(_ webview: WKWebView, count: Int = 0) {
    guard count < 180 else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
      webview.evaluateJavaScript("JSON.stringify({url:location.href,ready:document.readyState,runner:typeof window.__sanhaoIOSSelfTest,launch:!!document.querySelector('#app-launch-screen'),classes:document.documentElement.className,startupError:window.__sanhaoStartupError,body:document.body?.innerText.slice(0,2000),progress:window.__sanhaoIOSProgress})") { value, error in
        let path = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("ios-selftest-progress.json")
        try? ((value as? String) ?? String(describing: error)).write(to: path, atomically: true, encoding: .utf8)
        probe(webview, count: count + 1)
      }
    }
  }
  static func start(webview: WKWebView, reminders: NotificationEngine, attempts: Int = 0) {
    if attempts == 0 { probe(webview) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      webview.evaluateJavaScript("typeof window.__sanhaoIOSSelfTest === 'function' && !document.querySelector('#app-launch-screen')") { result, _ in
        guard result as? Bool == true else {
          if attempts < 120 { start(webview: webview, reminders: reminders, attempts: attempts + 1) }
          else { finish(webview: webview, report: ["failed": 1, "error": "Web test runner did not become ready"], phase: "timeout") }
          return
        }
        let phase = ProcessInfo.processInfo.environment["SANHAO_IOS_SELFTEST_PHASE"] ?? "features"
        let escaped = String(data: try! JSONEncoder().encode(phase), encoding: .utf8)!
        webview.evaluateJavaScript("window.__sanhaoIOSSelfTest(\(escaped)).then(r=>{window.__sanhaoIOSReport=JSON.stringify(r)}).catch(e=>{window.__sanhaoIOSReport=JSON.stringify({failed:1,error:String(e),stack:e.stack})}); 'started'") { _, error in
          if let error = error { finish(webview: webview, report: ["failed": 1, "error": String(describing: error)], phase: phase) }
          else { collect(webview: webview, reminders: reminders, phase: phase) }
        }
      }
    }
  }
  static func collect(webview: WKWebView, reminders: NotificationEngine, phase: String, attempts: Int = 0) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
      webview.evaluateJavaScript("window.__sanhaoIOSReport || null") { value, _ in
          guard let text = value as? String, let data = text.data(using: .utf8), var report = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            if attempts < 300 { collect(webview: webview, reminders: reminders, phase: phase, attempts: attempts + 1) }
            else { finish(webview: webview, report: ["failed": 1, "error": "Feature runner timed out"], phase: phase) }
            return
          }
          reminders.diagnostics { diagnostics in
            report["notifications"] = diagnostics
            report["foregroundDeliveries"] = reminders.defaults.array(forKey: "hhxx.ios.test-deliveries") ?? []
            if let event = report["expectedFocusEvent"] as? String {
              let deliveries = reminders.defaults.array(forKey: "hhxx.ios.test-deliveries") as? [[String: Any]] ?? []
              if !deliveries.contains(where: { $0["event"] as? String == event }) { report["failed"] = (report["failed"] as? Int ?? 0) + 1; report["notificationDeliveryError"] = "This run's focus notification never arrived" }
            }
            if phase == "offline", let requests = diagnostics["requests"] as? [[String: Any]], requests.contains(where: { ($0["id"] as? String ?? "").hasPrefix("hhxx.daily.") }) {
              report["failed"] = (report["failed"] as? Int ?? 0) + 1; report["disabledReminderError"] = "Disabled daily reminders still scheduled"
            }
            if phase == "features" && (report["failed"] as? Int ?? 1) == 0 {
              let deliveries = reminders.defaults.array(forKey: "hhxx.ios.test-deliveries") as? [[String: Any]] ?? []
              if !deliveries.contains(where: { $0["kind"] as? String == "focus" }) { report["failed"] = 1; report["notificationDeliveryError"] = "Scheduled focus notification never arrived" }
            }
            finish(webview: webview, report: report, phase: phase)
          }
      }
    }
  }
  static func finish(webview: WKWebView, report: [String: Any], phase: String) {
    let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
    let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    try? data?.write(to: directory.appendingPathComponent("ios-selftest-\(phase).json"), options: .atomic)
    DispatchQueue.main.async {
      let label = UILabel(frame: CGRect(x: 0, y: 50, width: 350, height: 25))
      label.accessibilityIdentifier = "ios-selftest-result"
      label.text = (report["failed"] as? Int ?? 1) == 0 ? "IOS_SELFTEST_DONE" : "IOS_SELFTEST_FAILED"
      label.font = .systemFont(ofSize: 11); label.backgroundColor = .white; label.textColor = .black
      webview.addSubview(label)
    }
  }
}
#endif
