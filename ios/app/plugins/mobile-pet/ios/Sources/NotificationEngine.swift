import Foundation
import UserNotifications
import UIKit

struct BridgeStatus: Encodable { let status: String; var snapshot: String? = nil }
struct DailySnapshot: Encodable {
  let enabled: Bool, message: String, hour: Int, minute: Int
  let lastShownDate: String, answerDate: String, answer: String, notificationPermission: String
}
final class NotificationEngine: NSObject, UNUserNotificationCenterDelegate {
  static let shared = NotificationEngine()
  let center = UNUserNotificationCenter.current()
  let defaults = UserDefaults.standard
  let feedback = ReminderFeedback()
  private let queue = DispatchQueue(label: "com.hikovo.sanhaotu.notifications")
  private let dailyKey = "hhxx.ios.daily.v1", memoKey = "hhxx.ios.memos.v1", focusKey = "hhxx.ios.focus.v1"
  private let stylesKey = "hhxx.ios.styles.v1"
  private var observer: NSObjectProtocol?
  override init() {
    super.init()
    center.delegate = self
    #if DEBUG
    if ProcessInfo.processInfo.environment["SANHAO_WEATHER_NOTIFICATION_CHECK"] == "1" { checkWeatherNotification() }
    #endif
    let actions = [UNNotificationAction(identifier: "daily.done", title: "做啦", options: []),
      UNNotificationAction(identifier: "daily.notYet", title: "还没有", options: []),
      UNNotificationAction(identifier: "daily.later", title: "稍后再问", options: [])]
    center.setNotificationCategories([UNNotificationCategory(identifier: "hhxx.daily", actions: actions, intentIdentifiers: [], options: [])])
    observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
      self?.reschedule { _ in }
    }
  }
  func read<T: Decodable>(_ key: String, fallback: T) -> T {
    guard let data = defaults.data(forKey: key), let value = try? JSONDecoder().decode(T.self, from: data) else { return fallback }
    return value
  }
  func save<T: Encodable>(_ value: T, key: String) throws { defaults.set(try JSONEncoder().encode(value), forKey: key) }
  func daily() -> DailySettings { read(dailyKey, fallback: DailySettings()) }
  func saveDaily(_ value: DailySettings) throws { try save(value, key: dailyKey) }
  func memos() -> [MemoRequest] { read(memoKey, fallback: [MemoRequest]()) }
  func saveMemos(_ values: [MemoRequest]) throws { try save(values, key: memoKey) }
  func focus() -> FocusRequest? { read(focusKey, fallback: Optional<FocusRequest>.none) }
  func saveFocus(_ value: FocusRequest?) throws { try save(value, key: focusKey) }
  func styles() -> [String: ReminderStyle] { read(stylesKey, fallback: [String: ReminderStyle]()) }
  func style(_ kind: String, id: String = "") -> ReminderStyle {
    let all = styles(); return all[id.isEmpty ? kind : kind + "/" + id] ?? all[kind] ?? ReminderStyle()
  }
  func saveStyle(_ value: ReminderStyle, kind: String, id: String) throws {
    var all = styles(); all[id.isEmpty ? kind : kind + "/" + id] = value; try save(all, key: stylesKey)
  }
  func authorizeIfNeeded(_ request: Bool, completion: @escaping (String) -> Void) {
    center.getNotificationSettings { settings in
      if request && settings.authorizationStatus == .notDetermined {
        self.center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in self.authorizeIfNeeded(false, completion: completion) }
      } else {
        let permission: String
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: permission = "granted"
        case .denied: permission = "denied"
        default: permission = "notDetermined"
        }
        completion(permission)
      }
    }
  }
  func snapshot(_ completion: @escaping (DailySnapshot) -> Void) {
    authorizeIfNeeded(false) { permission in
      let d = self.daily()
      completion(DailySnapshot(enabled: d.enabled, message: d.message, hour: d.hour, minute: d.minute,
        lastShownDate: d.lastShownDate, answerDate: d.answerDate, answer: d.answer, notificationPermission: permission))
    }
  }
  func diagnostics(_ completion: @escaping ([String: Any]) -> Void) {
    center.getPendingNotificationRequests { pending in
      self.authorizeIfNeeded(false) { permission in
        let own = pending.filter { $0.identifier.hasPrefix("hhxx.") }
        self.center.getDeliveredNotifications { delivered in
        completion(["permission": permission, "pending": own.count, "delivered": delivered.filter{$0.request.identifier.hasPrefix("hhxx.")}.map{["id":$0.request.identifier,"body":$0.request.content.body,"at":$0.date.timeIntervalSince1970]}, "requests": own.map {
          ["id": $0.identifier, "body": $0.content.body, "sound": $0.content.sound != nil, "eventId": $0.content.userInfo["eventId"] ?? "", "repeats": $0.trigger?.repeats ?? false, "next": (($0.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() ?? ($0.trigger as? UNTimeIntervalNotificationTrigger)?.nextTriggerDate())?.timeIntervalSince1970 ?? 0]
        }])
        }
      }
    }
  }
  func claim(_ kind: String, id: String, event: String) -> Bool {
    let key = "hhxx.ios.delivered.\(kind)/\(id)"
    if defaults.string(forKey: key) == event { return false }
    defaults.set(event, forKey: key); return true
  }
  func reschedule(_ completion: @escaping (Result<[String: Int], Error>) -> Void) {
    queue.async {
      let plan = ReminderPlan.make(daily: self.daily(), memos: self.memos(), focus: self.focus()).filter {
        let value = self.style($0.kind, id: $0.reminderId)
        return value.popup || value.sound || value.vibration
      }
      let signal = DispatchSemaphore(value: 0)
      var pending: [UNNotificationRequest] = []
      self.center.getPendingNotificationRequests { pending = $0; signal.signal() }
      guard signal.wait(timeout: .now() + 10) == .success else {
        completion(.failure(NSError(domain: "Reminder", code: 10, userInfo: [NSLocalizedDescriptionKey: "系统提醒服务暂时没有回应"]))); return
      }
      let independent = pending.filter { !$0.identifier.hasPrefix("hhxx.") || $0.identifier == "hhxx.snooze" }.count
      let selected = ReminderPlan.select(plan,capacity:min(60, max(0, 64 - independent)))
      // Only remove this app's managed reminders, preserving the independent snooze.
      self.center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.identifier.hasPrefix("hhxx.") && $0.identifier != "hhxx.snooze" }.map(\.identifier))
      let dailyStyle = self.style("daily")
      if !self.daily().enabled || !(dailyStyle.popup || dailyStyle.sound || dailyStyle.vibration) {
        self.center.removePendingNotificationRequests(withIdentifiers: ["hhxx.snooze"])
      }
      var errors: [Error] = []
      let group = DispatchGroup(), lock = NSLock()
      for item in selected {
        do {
          let style = self.style(item.kind, id: item.reminderId)
          let content = UNMutableNotificationContent()
          content.title = item.kind == "meal" ? "兔兔陪你好好吃饭" : "好好想想"; content.body = item.message
          content.threadIdentifier = "hhxx." + item.kind
          content.categoryIdentifier = item.kind == "daily" ? "hhxx.daily" : ""
          content.userInfo = ["kind": item.kind, "reminderId": item.reminderId, "eventId": item.eventId, "popup": style.popup]
          if style.sound {
            let file = try self.feedback.soundFile(style)
            content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: file.lastPathComponent))
          }
          let units:Set<Calendar.Component> = item.repeatsWeekly ? [.weekday,.hour,.minute] : item.repeatsDaily ? [.hour,.minute] : [.year,.month,.day,.hour,.minute,.second]
          let components = Calendar.current.dateComponents(units, from: item.date)
          let request = UNNotificationRequest(identifier: item.identifier, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: item.repeatsDaily || item.repeatsWeekly))
          group.enter()
          self.center.add(request) { error in
            if let error = error { lock.lock(); errors.append(error); lock.unlock() }
            group.leave()
          }
        } catch { lock.lock(); errors.append(error); lock.unlock() }
      }
      let weatherStyle = self.style("weather")
      for request in pending where request.identifier.hasPrefix("sanhao.weather.") && request.identifier != "sanhao.weather.qa-notification" {
        if !(weatherStyle.popup || weatherStyle.vibration || weatherStyle.sound) {
          self.center.removePendingNotificationRequests(withIdentifiers:[request.identifier]); continue
        }
        do {
          let content = request.content.mutableCopy() as! UNMutableNotificationContent
          content.userInfo["popup"] = weatherStyle.popup; content.sound = nil
          if weatherStyle.sound { content.sound = UNNotificationSound(named:UNNotificationSoundName(rawValue:try self.feedback.soundFile(weatherStyle).lastPathComponent)) }
          group.enter()
          self.center.add(UNNotificationRequest(identifier:request.identifier,content:content,trigger:request.trigger)) { error in
            if let error { lock.lock(); errors.append(error); lock.unlock() }; group.leave()
          }
        } catch { lock.lock(); errors.append(error); lock.unlock() }
      }
      guard group.wait(timeout: .now() + 15) == .success else {
        completion(.failure(NSError(domain: "Reminder", code: 11, userInfo: [NSLocalizedDescriptionKey: "系统提醒保存超时，请重新打开 App"] ))); return
      }
      if let error = errors.first { completion(.failure(error)) }
      else { completion(.success(["scheduled": selected.count, "deferred": max(0, plan.count - selected.count)])) }
    }
  }
  func answer(_ answer: String) throws {
    var d = daily(); d.answer = answer; d.answerDate = ReminderPlan.today(); try saveDaily(d)
    center.removeDeliveredNotifications(withIdentifiers: ["hhxx.daily." + d.answerDate, "hhxx.snooze"])
    if answer == "done" { center.removePendingNotificationRequests(withIdentifiers: ["hhxx.snooze"]) }
    else { snooze() }
  }
  func snooze() {
    let value = style("daily")
    guard daily().enabled && (value.popup || value.sound || value.vibration) else { return }
    let content = UNMutableNotificationContent(); content.title = "好好想想"; content.body = daily().message
    content.categoryIdentifier = "hhxx.daily"; content.userInfo = ["kind": "daily", "reminderId": "", "eventId": String(Int64((Date().timeIntervalSince1970 + 600) * 1000)), "popup": true]
    if style("daily").sound, let sound = try? feedback.soundFile(style("daily")) { content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: sound.lastPathComponent)) }
    center.add(UNNotificationRequest(identifier: "hhxx.snooze", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 600, repeats: false)))
  }
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completion: @escaping (UNNotificationPresentationOptions) -> Void) {
    // Weather requests use WeatherKit's forecast text, not the memo style engine.
    // They must still present while the app is in the foreground.
    if notification.request.identifier.hasPrefix("sanhao.weather.") {
      #if DEBUG
      if ProcessInfo.processInfo.environment["SANHAO_WEATHER_NOTIFICATION_CHECK"] == "1", notification.request.identifier == "sanhao.weather.qa-notification" {
        weatherCheckReport(["delivered":true,"bannerRequested":true,"listRequested":true,"soundRequested":false,"testAuthorization":"provisional"])
      }
      #endif
      let value = style("weather")
      DispatchQueue.main.async { try? self.feedback.play(value) }
      completion(value.popup ? [.banner,.list] : [.list]); return
    }
    let data = notification.request.content.userInfo
    let kind = data["kind"] as? String ?? "", id = data["reminderId"] as? String ?? ""
    let event = kind == "meal" ? ReminderPlan.today(notification.date) : data["eventId"] as? String ?? ""
    guard !event.isEmpty && claim(kind, id: id, event: event) else { completion([]); return }
    #if DEBUG
    if ProcessInfo.processInfo.environment["SANHAO_IOS_SELFTEST"] == "1" {
      var events = defaults.array(forKey: "hhxx.ios.test-deliveries") ?? []
      events.append(["kind": kind, "id": id, "event": event, "at": Date().timeIntervalSince1970]); defaults.set(events, forKey: "hhxx.ios.test-deliveries")
    }
    #endif
    let value = style(kind, id: id)
    DispatchQueue.main.async { try? self.feedback.play(value) }
    // The WebView shows its own in-app question/task panel. The system banner
    // remains available for reminders not currently open in that panel.
    completion(value.popup ? [.banner, .list] : [.list])
  }
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completion: @escaping () -> Void) {
    if response.notification.request.identifier.hasPrefix("sanhao.weather.") {
      defaults.set(true,forKey:"rabbit.pending-weather-open.v1"); completion(); return
    }
    let data = response.notification.request.content.userInfo
    if data["kind"] as? String == "meal", let meal = data["reminderId"] as? String,
      ["breakfast","lunch","dinner"].contains(meal) {
      defaults.set(meal,forKey:"rabbit.pending-meal-open.v1"); completion(); return
    }
    DispatchQueue.main.async {
      if response.actionIdentifier == "daily.done" { try? self.answer("done") }
      else if response.actionIdentifier == "daily.notYet" { try? self.answer("notYet") }
      else if response.actionIdentifier == "daily.later" { self.snooze() }
      self.reschedule { _ in completion() }
    }
  }
  #if DEBUG
  private func weatherCheckReport(_ value:[String:Any]) {
    if let data = try? JSONSerialization.data(withJSONObject:value,options:[.prettyPrinted,.sortedKeys]),let folder = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
      try? data.write(to:folder.appendingPathComponent("weather-notification-check.json"),options:.atomic)
    }
  }
  private func checkWeatherNotification() {
    center.requestAuthorization(options:[.alert,.sound,.provisional]) { allowed,error in
      guard allowed,error == nil else { self.weatherCheckReport(["delivered":false,"permission":allowed]); return }
      let content = UNMutableNotificationContent(); content.title = "天气通知检查"; content.body = "专用回归模拟器的通知投递检查"; content.sound = .default
      self.center.add(UNNotificationRequest(identifier:"sanhao.weather.qa-notification",content:content,trigger:UNTimeIntervalNotificationTrigger(timeInterval:5,repeats:false))) { error in
        if let error { self.weatherCheckReport(["delivered":false,"domain":(error as NSError).domain,"code":(error as NSError).code]) }
      }
    }
  }
  #endif

}
