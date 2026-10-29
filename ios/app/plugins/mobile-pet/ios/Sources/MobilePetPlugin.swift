import UIKit
import AVFoundation
import WebKit
import UserNotifications
import Tauri

// Public dynamic linking avoids unresolved host symbols during Cargo's separate
// library build. Xcode exports these two app-owned functions explicitly.
private typealias RabbitBridgeFunction = @convention(c) (UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?
private func rabbitHostCall(_ name: String, _ value: String) -> UnsafeMutablePointer<CChar>? {
  guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), name) else { return nil }
  let function = unsafeBitCast(symbol, to: RabbitBridgeFunction.self)
  return value.withCString { function($0) }
}

struct OpenExternalArgs: Decodable { let url: String }
struct CopyArgs: Decodable { let text: String }
struct PayloadArgs: Decodable { let payload: String }
struct SaveDailyArgs: Decodable { let enabled: Bool; let message: String; let hour: Int; let minute: Int }
struct AnswerArgs: Decodable { let answer: String }
struct FocusArgs: Decodable { let delayMs: Double; let deadlineMs: Double?; let message: String; let leadMinutes: Int }

class MobilePetPlugin: Plugin {
  private let reminders = NotificationEngine.shared
  private let weatherSpeech = AVSpeechSynthesizer()
  private let rabbitPiP = RabbitPictureInPicture()
  private let glassDock = NativeGlassDock()
  override func load(webview: WKWebView) {
    // Close an old PiP session after upgrade; the app keeps its companion inside the app.
    rabbitPiP.webview = webview
    rabbitPiP.stop { }
    glassDock.attach(to: webview)
    reminders.reschedule { _ in }
    #if DEBUG
    if ProcessInfo.processInfo.environment["SANHAO_IOS_SELFTEST"] == "1" {
      let probe = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0].appendingPathComponent("ios-selftest-launch.json")
      try? Data("{\"started\":true}".utf8).write(to:probe,options:.atomic)
      IOSSelfTest.start(webview:webview,reminders:reminders)
    }
    #endif
  }
  @objc public func copyText(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(CopyArgs.self)
    guard args.text.utf8.count <= 1_000_000 else { invoke.reject("要复制的内容过长"); return }
    DispatchQueue.main.async { UIPasteboard.general.string = args.text; invoke.resolve(BridgeStatus(status: "copied")) }
  }
  @objc public func hapticTap(_ invoke: Invoke) {
    DispatchQueue.main.async { UIImpactFeedbackGenerator(style: .light).impactOccurred(); invoke.resolve(BridgeStatus(status: "ok")) }
  }
  @objc public func openExternal(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(OpenExternalArgs.self)
    guard let url = URL(string: args.url), ["https", "http"].contains(url.scheme?.lowercased() ?? "") else {
      invoke.reject("仅支持网页链接", code: "invalid_url"); return
    }
    DispatchQueue.main.async {
      UIApplication.shared.open(url, options: [:]) { opened in
        if opened { invoke.resolve(BridgeStatus(status: "opened")) }
        else { invoke.reject("链接暂时无法打开", code: "open_failed") }
      }
    }
  }
  @objc public func overlayStatus(_ invoke: Invoke) throws {
    guard let result = rabbitHostCall("sanhao_rabbit_live","status") else { invoke.resolve(BridgeStatus(status:"inactive")); return }
    defer { free(result) }
    let snapshot = String(cString:result)
    let data = (try? JSONSerialization.jsonObject(with:Data(snapshot.utf8))) as? [String:Any]
    invoke.resolve(BridgeStatus(status:data?["status"] as? String ?? "inactive",snapshot:snapshot))
  }
  @objc public func startOverlay(_ invoke: Invoke) throws { invoke.resolve(BridgeStatus(status:"inactive")) }
  @objc public func stopOverlay(_ invoke: Invoke) { invoke.resolve(BridgeStatus(status:"inactive")) }
  @objc public func speakWeather(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard let data = try JSONSerialization.jsonObject(with:Data(args.payload.utf8)) as? [String:Any] else { invoke.reject("这份天气还没准备好"); return }
    let stop = data["stop"] as? Bool == true, text = data["text"] as? String ?? ""
    guard stop || (!text.isEmpty && text.count <= 1200) else { invoke.reject("先更新一下天气，再来听吧"); return }
    DispatchQueue.main.async {
      self.weatherSpeech.stopSpeaking(at:.immediate)
      if !stop { let utterance = AVSpeechUtterance(string:text); utterance.voice = AVSpeechSynthesisVoice(language:"zh-CN"); utterance.rate = 0.46; self.weatherSpeech.speak(utterance) }
      invoke.resolve(BridgeStatus(status:stop ? "stopped" : "speaking"))
    }
  }
  @objc public func localModel(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count <= 32_000 else { invoke.reject("这句话有点长，分开说说吧"); return }
    if let request=(try? JSONSerialization.jsonObject(with:Data(args.payload.utf8))) as? [String:Any],
       let operation=request["operation"] as? String,
       ["assetStatus","download","cancelDownload"].contains(operation) {
      Task { @MainActor in
        let snapshot=LocalModelAssets.shared.handle(operation)
        invoke.resolve(BridgeStatus(status:"completed",snapshot:snapshot))
      }
      return
    }
    DispatchQueue.global(qos:.userInitiated).async {
      guard let pointer = rabbitHostCall("sanhao_local_chat",args.payload) else {
        DispatchQueue.main.async { invoke.resolve(BridgeStatus(status:"unavailable")) }; return
      }
      let snapshot = String(cString:pointer); free(pointer)
      DispatchQueue.main.async { invoke.resolve(BridgeStatus(status:"completed",snapshot:snapshot)) }
    }
  }
  @objc public func syncWidgets(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count < 2_000_000 else { invoke.reject("这次内容有点多，请稍后再试"); return }
    let pointer = rabbitHostCall("sanhao_rabbit_sync", args.payload)
    guard let pointer else { invoke.reject("暂时没有保存好，再试一次吧"); return }
    defer { free(pointer) }
    let snapshot = String(cString: pointer)
    if let bytes = snapshot.data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any], let error = value["error"] as? String { invoke.reject(error); return }
    invoke.resolve(BridgeStatus(status: "synced", snapshot: snapshot))
  }
  @objc public func ledgerStore(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count < 1_000_000 else { invoke.reject("账本请求过大"); return }
    do {
      let state = try LedgerStore.shared.handle(Data(args.payload.utf8))
      invoke.resolve(BridgeStatus(status: "saved", snapshot: String(decoding: try JSONEncoder().encode(state), as: UTF8.self)))
    } catch { invoke.reject(error.localizedDescription) }
  }
  @objc public func timetableStore(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count < 2_000_000 else { invoke.reject("课表请求过大"); return }
    do { let state = try TimetableStore.shared.handle(Data(args.payload.utf8)); invoke.resolve(BridgeStatus(status:"saved",snapshot:String(decoding:try JSONEncoder().encode(state),as:UTF8.self))) } catch { invoke.reject(error.localizedDescription) }
  }
  @objc public func timetableScan(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count < 28_000_000, let bytes = Data(base64Encoded:args.payload) else { invoke.reject("文件太大或无法读取，请选择 20 MB 以内的截图或 PDF"); return }
    DispatchQueue.global(qos:.userInitiated).async {
      do { let result = try TimetableScanner.scan(bytes); let snapshot = String(decoding:try JSONEncoder().encode(result),as:UTF8.self); DispatchQueue.main.async { invoke.resolve(BridgeStatus(status:"recognized",snapshot:snapshot)) } }
      catch { let message = error.localizedDescription; DispatchQueue.main.async { invoke.reject(message) } }
    }
  }
  @objc public func healthStore(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count < 1_000_000 else { invoke.reject("记录请求过大"); return }
    do {
      let state = try HealthStore.shared.handle(Data(args.payload.utf8))
      invoke.resolve(BridgeStatus(status: "saved", snapshot: String(decoding: try JSONEncoder().encode(state), as: UTF8.self)))
    } catch { invoke.reject(error.localizedDescription) }
  }
  @objc public func dailyReminderState(_ invoke: Invoke) { reminders.snapshot { invoke.resolve($0) } }
  private func scheduled(_ invoke: Invoke, daily: Bool = false) {
    reminders.reschedule { result in
      switch result {
      case .failure(let error): invoke.reject(error.localizedDescription, code: "schedule_failed")
      case .success(let info):
        if daily { self.reminders.snapshot { invoke.resolve($0) } }
        else {
          let json = (try? JSONSerialization.data(withJSONObject: info)).map { String(decoding: $0, as: UTF8.self) }
          self.reminders.authorizeIfNeeded(false) { permission in
            invoke.resolve(BridgeStatus(status: permission == "granted" ? "scheduled" : "permissionRequired", snapshot: json))
          }
        }
      }
    }
  }
  @objc public func saveDailyReminder(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SaveDailyArgs.self)
    guard (0...23).contains(args.hour) && (0...59).contains(args.minute) else { invoke.reject("请选择有效的时间"); return }
    var state = reminders.daily(); state.enabled = args.enabled
    state.message = String(args.message.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
    if state.message.isEmpty { state.message = "今天好好吃饭了嘛？" }
    state.hour = args.hour; state.minute = args.minute; try reminders.saveDaily(state)
    if !state.enabled { reminders.center.removePendingNotificationRequests(withIdentifiers: ["hhxx.snooze"]) }
    reminders.authorizeIfNeeded(state.enabled) { _ in self.scheduled(invoke, daily: true) }
  }
  @objc public func markDailyPromptShown(_ invoke: Invoke) throws {
    var state = reminders.daily(); state.lastShownDate = ReminderPlan.today(); try reminders.saveDaily(state)
    reminders.snapshot { invoke.resolve($0) }
  }
  @objc public func answerDailyReminder(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(AnswerArgs.self)
    guard ["done", "notYet", "later"].contains(args.answer) else { invoke.reject("回答格式不正确"); return }
    if args.answer == "later" { reminders.snooze() } else { try reminders.answer(args.answer) }
    scheduled(invoke, daily: true)
  }
  @objc public func syncMemoReminders(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    guard args.payload.utf8.count <= 2_000_000 else { invoke.reject("提醒内容过大"); return }
    let items = try JSONDecoder().decode([MemoRequest].self, from: Data(args.payload.utf8))
    guard items.allSatisfy({ $0.id.count <= 150 && $0.reminderId.count <= 100 && !$0.reminderId.contains("/") && $0.triggerAt.isFinite }) else { invoke.reject("提醒内容无效"); return }
    let previous = reminders.memos(); try reminders.saveMemos(items)
    let newlyEnabled = items.contains { item in !item.completed && item.triggerAt > Date().timeIntervalSince1970 * 1000 && !previous.contains { $0.id == item.id && !$0.completed } }
    reminders.authorizeIfNeeded(newlyEnabled) { _ in self.scheduled(invoke) }
  }
  @objc public func scheduleFocusReminder(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(FocusArgs.self)
    guard args.delayMs.isFinite && (1000...10_800_000).contains(args.delayMs) && (0...180).contains(args.leadMinutes) else { invoke.reject("专注时间无效"); return }
    if let deadline = args.deadlineMs {
      let distance = deadline - Date().timeIntervalSince1970 * 1000
      guard deadline.isFinite && (0...10_801_000).contains(distance) else { invoke.reject("专注结束时间无效"); return }
    }
    try reminders.saveFocus(FocusRequest(deadline: args.deadlineMs ?? (Date().timeIntervalSince1970 * 1000 + args.delayMs), message: args.message, leadMinutes: args.leadMinutes))
    reminders.authorizeIfNeeded(true) { _ in self.scheduled(invoke) }
  }
  @objc public func cancelFocusReminder(_ invoke: Invoke) throws {
    try reminders.saveFocus(nil); reminders.center.removeDeliveredNotifications(withIdentifiers: ["hhxx.focus.end", "hhxx.focus.lead"])
    scheduled(invoke)
  }
  @objc public func reminderStyle(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PayloadArgs.self)
    let bytes = Data(args.payload.utf8)
    guard let data = try JSONSerialization.jsonObject(with: bytes) as? [String: Any], let action = data["action"] as? String else { invoke.reject("提醒选项无效"); return }
    if action == "settings" {
      DispatchQueue.main.async {
        let text: String
        if data["target"] as? String == "notifications", #available(iOS 16, *) { text = UIApplication.openNotificationSettingsURLString }
        else { text = UIApplication.openSettingsURLString }
        UIApplication.shared.open(URL(string: text)!) { opened in
          if opened { invoke.resolve(BridgeStatus(status: "opened")) } else { invoke.reject("请在手机设置中找到好好想想") }
        }
      }; return
    }
    #if DEBUG
    if action == "diagnostics", ProcessInfo.processInfo.environment["SANHAO_IOS_SELFTEST"] == "1" {
      reminders.diagnostics { value in
        let bytes = (try? JSONSerialization.data(withJSONObject:value)) ?? Data("{}".utf8)
        invoke.resolve(BridgeStatus(status:"diagnostics",snapshot:String(decoding:bytes,as:UTF8.self)))
      }; return
    }
    #endif
    if action == "stop" { DispatchQueue.main.async { self.reminders.feedback.stop(); invoke.resolve(BridgeStatus(status: "stopped")) }; return }
    guard let kind = data["kind"] as? String, ["daily", "todo", "countdown", "focus", "course", "habit", "meal", "weather"].contains(kind) else { invoke.reject("提醒类型无效"); return }
    let id = data["reminderId"] as? String ?? ""
    guard id.count <= 100 && !id.contains("/") else { invoke.reject("提醒标识无效"); return }
    if action == "fire" {
      guard let event = data["eventId"] as? String, !event.isEmpty && event.count <= 100 else { invoke.reject("提醒事件无效"); return }
      DispatchQueue.main.async {
        guard self.reminders.claim(kind, id: id, event: event) else { invoke.resolve(BridgeStatus(status: "alreadyDelivered")); return }
        do { try self.reminders.feedback.play(self.reminders.style(kind, id: id)); invoke.resolve(BridgeStatus(status: "delivered")) }
        catch { self.reminders.defaults.removeObject(forKey: "hhxx.ios.delivered.\(kind)/\(id)"); invoke.reject(error.localizedDescription) }
      }; return
    }
    guard ["save", "preview"].contains(action) else { invoke.reject("提醒操作无效"); return }
    var value = try JSONDecoder().decode(ReminderStyle.self, from: bytes)
    guard (1...15).contains(value.soundSeconds) && (1...15).contains(value.vibrationSeconds), ["single", "double", "slow"].contains(value.rhythm) else { invoke.reject("请选择 1–15 秒的提醒"); return }
    if let audio = data["audio"] as? String {
      guard action == "save" else { invoke.reject("请先保存铃声"); return }
      value.tone = try reminders.feedback.importWave(audio)
    }
    _ = try reminders.feedback.soundFile(value)
    let json = try JSONSerialization.data(withJSONObject: ["tone": value.tone, "warning": "离开 App 后，震动节奏与持续时间由 iOS 设置决定。"])
    let snapshot = String(decoding: json, as: UTF8.self)
    if action == "save" {
      try reminders.saveStyle(value, kind: kind, id: id)
      reminders.reschedule { result in
        switch result {
        case .success: invoke.resolve(BridgeStatus(status: "saved", snapshot: snapshot))
        case .failure(let error): invoke.reject(error.localizedDescription, code: "schedule_failed")
        }
      }
    } else {
      DispatchQueue.main.async {
        do { try self.reminders.feedback.play(value); invoke.resolve(BridgeStatus(status: "previewed", snapshot: snapshot)) }
        catch { invoke.reject(error.localizedDescription) }
      }
    }
  }
}

@_cdecl("init_plugin_mobile_pet")
func initPlugin() -> Plugin { MobilePetPlugin() }
