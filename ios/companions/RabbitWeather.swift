import Foundation
import CoreLocation
import WeatherKit
import UserNotifications

@available(iOS 17.0, *)
@MainActor final class RabbitWeather: NSObject, @preconcurrency CLLocationManagerDelegate {
  static let shared = RabbitWeather()
  private let location = CLLocationManager()
  private let center = UNUserNotificationCenter.current()
  private let key = "rabbit.weather.settings.v1"
  private let prefix = "sanhao.weather."
  private var settings = RabbitWeatherSettings()
  private var initialized = false, busy = false
  private var revision = 0
  private var lastRefresh = Date.distantPast
  private var lastAttempt = Date.distantPast
  private var refreshQueued = false
  private var fetchTask: Task<Void, Never>?
  private var locationTimeout: Task<Void, Never>?
  private override init() {
    super.init(); location.delegate = self
    location.desiredAccuracy = kCLLocationAccuracyThreeKilometers
    #if DEBUG
    if ProcessInfo.processInfo.environment["SANHAO_WEATHER_PROBE"] == "1" {
      Task { await self.connectionProbe() }
    }
    #endif
  }
  private func status(_ message: String, count: Int = 0, mark: String = "", legal: String = "", current: [String: Any]? = nil, solar: [[String: Any]]? = nil) {
    var result: [String: Any] = ["message": message, "scheduled": count, "mark": mark, "legal": legal]
    result["current"] = current ?? (UserDefaults.standard.dictionary(forKey: "rabbit.weather.status.v1")?["current"] as? [String: Any])
    result["solar"] = solar ?? (UserDefaults.standard.dictionary(forKey:"rabbit.weather.status.v1")?["solar"] as? [[String:Any]])
    UserDefaults.standard.set(result, forKey: "rabbit.weather.status.v1")
    if let current, let bytes = try? JSONSerialization.data(withJSONObject: current), let report = try? JSONDecoder().decode(RabbitWeatherReport.self, from: bytes) {
      try? RabbitStore.transaction { $0.weather = report }
    }
  }
  func apply(_ proposed: RabbitWeatherSettings, force: Bool) {
    var next = proposed
    next.times = next.reminderTimes; next.time = next.reminderTimes[0]
    let changed = !initialized || settings != next
    if changed {
      initialized = true; settings = next; revision += 1; busy = false
      locationTimeout?.cancel(); fetchTask?.cancel(); fetchTask = nil; refreshQueued = false
      UserDefaults.standard.set(try? JSONEncoder().encode(settings), forKey: key)
      clearPending()
    }
    guard settings.enabled || settings.lightsEnabled else { if changed { status("天气提醒已关闭") }; return }
    guard Bundle.main.object(forInfoDictionaryKey: "RabbitWeatherEnabled") as? Bool == true else {
      status("这个版本暂时无法获取天气，请更新 App 后再试。")
      return
    }
    if busy { if force { refreshQueued = true }; return }
    guard changed || force || (Date.now.timeIntervalSince(lastRefresh) > 1800 && Date.now.timeIntervalSince(lastAttempt) > 120) else { return }
    lastAttempt = .now
    busy = true; status("正在更新天气…")
    switch location.authorizationStatus {
    case .notDetermined: location.requestWhenInUseAuthorization()
    case .authorizedAlways, .authorizedWhenInUse: requestLocation()
    default: busy = false; status("请在系统设置中允许定位，才能提醒当地的冷暖晴雨")
    }
  }
  private func clearPending() {
    let token = revision
    Task {
      let requests = await center.pendingNotificationRequests()
      guard revision == token else { return }
      center.removePendingNotificationRequests(withIdentifiers: requests.filter { $0.identifier.hasPrefix(prefix) }.map(\.identifier))
    }
  }
  private func requestLocation() {
    location.requestLocation()
    locationTimeout?.cancel()
    let token = revision
    locationTimeout = Task { [weak self] in
      try? await Task.sleep(for: .seconds(20))
      guard !Task.isCancelled, let self, self.revision == token, self.busy else { return }
      self.busy = false; self.status("暂时无法获取位置，请稍后刷新")
    }
  }
  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard initialized, settings.enabled || settings.lightsEnabled, busy else { return }
    if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse { requestLocation() }
    else if manager.authorizationStatus != .notDetermined { busy = false; status("定位未允许，天气提醒尚未开启") }
  }
  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    guard busy else { return }
    locationTimeout?.cancel(); busy = false
    record(error, stage:"location")
    status("暂时无法获取位置，请打开系统定位后再刷新。")
  }
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let point = locations.last, settings.enabled || settings.lightsEnabled, busy else { return }
    locationTimeout?.cancel()
    let token = revision, requested = settings
    guard fetchTask == nil else { return }
    fetchTask = Task {
      defer {
        if revision == token {
          busy = false; fetchTask = nil
          if refreshQueued { refreshQueued = false; apply(settings, force:true) }
        }
      }
      do {
        let weather = try await Self.withTimeout { try await WeatherService.shared.weather(for: point) }
        guard revision == token, !Task.isCancelled else { return }
        // Attribution is required for display, but a failed credit fetch must not
        // discard a valid forecast or daylight schedule. Use Apple's legal page.
        var mark = "", legal = "https://weatherkit.apple.com/legal-attribution.html"
        do {
          let credit = try await Self.withTimeout { try await WeatherService.shared.attribution }
          mark = credit.combinedMarkLightURL.absoluteString; legal = credit.legalPageURL.absoluteString
        } catch { record(error, stage:"attribution") }
        let allowed = requested.enabled ? ((try? await center.requestAuthorization(options: [.alert, .sound])) ?? false) : false
        guard revision == token, settings.enabled || settings.lightsEnabled else { return }
        let pending = await center.pendingNotificationRequests()
        let budget = max(0, 64 - pending.filter { !$0.identifier.hasPrefix(prefix) }.count)
        center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.identifier.hasPrefix(prefix) }.map(\.identifier))
        let calendar = Calendar.current
        let cachedHighs = UserDefaults.standard.dictionary(forKey: "rabbit.weather.highs.v1") ?? [:]
        var newHighs: [String: Double] = [:]
        var count = 0
        var solar: [[String:Any]] = []
        var current: [String: Any]?
        for day in weather.dailyForecast.forecast.prefix(7) {
          let key = RabbitStore.today(day.date)
          if let rise = day.sun.sunrise, let set = day.sun.sunset { solar.append(["date":key,"sunrise":rise.timeIntervalSince1970 * 1000,"sunset":set.timeIntervalSince1970 * 1000]) }
          let low = day.lowTemperature.converted(to: .celsius).value
          let high = day.highTemperature.converted(to: .celsius).value
          newHighs[key] = high
          let yesterday = calendar.date(byAdding: .day, value: -1, to: day.date)!
          let previous = newHighs[RabbitStore.today(yesterday)] ?? (cachedHighs[RabbitStore.today(yesterday)] as? Double)
          if key == RabbitStore.today(.now) {
            let currentAdvice = RabbitWeatherAdvice.reminders(low:low,high:high,previousHigh:previous,rainChance:day.precipitationChance,uv:day.uvIndex.value,wind:day.wind.speed.converted(to:.metersPerSecond).value,rules:requested.reminderRules)
            let bulletin = RabbitWeatherAdvice.bulletin(low:low,high:high,condition:String(describing:day.condition),hour:calendar.component(.hour,from:.now),temperature:weather.currentWeather.temperature.converted(to:.celsius).value,rainChance:day.precipitationChance,wind:day.wind.speed.converted(to:.metersPerSecond).value,uv:day.uvIndex.value,advice:currentAdvice)
            current = ["date": key, "low": low, "high": high, "bulletin":bulletin,
              "advice": RabbitWeatherAdvice.text(low: low, high: high, previousHigh: previous, rainChance: day.precipitationChance)]
          }
          for time in requested.enabled && allowed ? requested.reminderTimes : [] {
            let parts = time.split(separator: ":").compactMap { Int($0) }
            guard let fire = calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day.date), fire > .now, count < budget else { continue }
            // Prefer the forecast for the selected hour, then the daily forecast.
            let hour = weather.hourlyForecast.forecast.first { calendar.isDate($0.date, equalTo: fire, toGranularity: .hour) }
            let temperature = hour?.temperature.converted(to: .celsius).value
            let daytime = (7...18).contains(parts[0])
            let advice = RabbitWeatherAdvice.reminders(low: temperature ?? low,
              high: temperature ?? high,
              previousHigh: previous.map { (temperature ?? high) + max(0, $0 - high) },
              rainChance: hour?.precipitationChance ?? day.precipitationChance,
              uv: daytime ? (hour?.uvIndex.value ?? day.uvIndex.value) : 0,
              wind: hour?.wind.speed.converted(to: .metersPerSecond).value ?? day.wind.speed.converted(to: .metersPerSecond).value,
              rules: requested.reminderRules)
            let content = UNMutableNotificationContent()
            content.title = "兔兔的天气小叮咛"
            content.body = RabbitWeatherAdvice.bulletin(low:low,high:high,condition:String(describing:day.condition),hour:parts[0],temperature:temperature,rainChance:hour?.precipitationChance ?? day.precipitationChance,wind:hour?.wind.speed.converted(to:.metersPerSecond).value ?? day.wind.speed.converted(to:.metersPerSecond).value,uv:daytime ? (hour?.uvIndex.value ?? day.uvIndex.value) : 0,advice:advice)
            let style = Self.deliveryStyle()
            guard style.popup || style.vibration || style.sound else { continue }
            if style.sound { content.sound = UNNotificationSound(named:UNNotificationSoundName(rawValue:style.file)) }
            content.userInfo = ["kind":"weather","eventId":prefix + key + "." + time,"popup":style.popup]
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
            let request = UNNotificationRequest(identifier: prefix + key + "." + time, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false))
            guard revision == token else { return }
            do { try await center.add(request); count += 1 }
            catch { record(error, stage:"notification") }
            if revision != token { center.removePendingNotificationRequests(withIdentifiers: [request.identifier]); return }
          }
        }
        UserDefaults.standard.set(cachedHighs.merging(newHighs) { _, new in new }, forKey: "rabbit.weather.highs.v1")
        lastRefresh = .now
        status(!requested.enabled ? "灯光时间已更新" : !allowed ? "请在系统设置中允许通知，才能收到天气提醒" : count > 0 ? "天气提醒已更新" : budget == 0 ? "通知额度已满，稍后再更新提醒" : "天气提醒已更新", count: count, mark: mark, legal: legal, current: current, solar: solar)
      } catch {
        guard revision == token else { return }
        guard !Task.isCancelled else { return }
        record(error, stage:"forecast")
        let code = (error as NSError).code
        status((error as NSError).domain == NSURLErrorDomain
          ? (code == NSURLErrorTimedOut ? "天气连接有些慢，稍后点刷新再试试。" : "暂时连不上天气，请检查 App 的无线数据权限和网络。")
          : "天气服务暂时不可用，请稍后刷新。")
      }
    }
  }
  private static func deliveryStyle() -> (popup:Bool,vibration:Bool,sound:Bool,file:String) {
    let bytes = UserDefaults.standard.data(forKey:"hhxx.ios.styles.v1")
    let styles = bytes.flatMap { try? JSONSerialization.jsonObject(with:$0) } as? [String:[String:Any]]
    let value = styles?["weather"] ?? [:]
    let requestedTone = value["tone"] as? String ?? "gentle"
    let validTone = ["gentle","chime","three"].contains(requestedTone) || requestedTone.range(of:"^custom-[a-f0-9]{64}$",options:.regularExpression) != nil
    let tone = validTone ? requestedTone : "gentle", seconds = min(15,max(1,value["soundSeconds"] as? Int ?? 15))
    return (value["popup"] as? Bool ?? true,value["vibration"] as? Bool ?? false,value["sound"] as? Bool ?? false,"\(tone)-\(seconds)s.wav")
  }
  private func record(_ error: Error, stage: String) {
    let value = error as NSError
    // No coordinates, tokens, forecast payload, or personal data in diagnostics.
    NSLog("SanhaoWeather stage=%@ domain=%@ code=%ld",stage,value.domain,value.code)
    UserDefaults.standard.set(["stage":stage,"domain":value.domain,"code":value.code],forKey:"rabbit.weather.error.v1")
  }
  private static func withTimeout<T: Sendable>(_ operation: @escaping @Sendable () async throws -> T) async throws -> T {
    // WeatherKit may take time to honour cancellation. A task group waits for
    // every child on scope exit, so it cannot enforce a UI deadline here.
    try await withCheckedThrowingContinuation { continuation in
      let gate = WeatherRequestGate<T>(continuation)
      gate.work = Task {
        do { gate.finish(.success(try await operation())) }
        catch { gate.finish(.failure(error)) }
      }
      gate.timer = Task {
        try? await Task.sleep(for:.seconds(25))
        guard !Task.isCancelled else { return }
        gate.finish(.failure(URLError(.timedOut)))
      }
    }
  }

  #if DEBUG
  private func connectionProbe() async {
    var report:[String:Any] = ["createdAt":ISO8601DateFormatter().string(from:.now),"fixture":"Hangzhou city centre; not device location"]
    saveProbe(report.merging(["stage":"forecast"]) { _,new in new })
    do {
      let weather = try await Self.withTimeout { try await WeatherService.shared.weather(for:CLLocation(latitude:30.2741,longitude:120.1551)) }
      report["forecast"] = ["success":true,"days":weather.dailyForecast.forecast.count]
    } catch { report["forecast"] = Self.probeError(error) }
    saveProbe(report.merging(["stage":"attribution"]) { _,new in new })
    do { _ = try await Self.withTimeout { try await WeatherService.shared.attribution }; report["attribution"] = ["success":true] }
    catch { report["attribution"] = Self.probeError(error) }
    report["locationAuthorization"] = location.authorizationStatus.rawValue
    try? await Task.sleep(for:.seconds(5))
    let currentStatus = UserDefaults.standard.dictionary(forKey:"rabbit.weather.status.v1") ?? [:]
    let current = currentStatus["current"] as? [String:Any]
    report["appWeather"] = ["message":currentStatus["message"] as? String ?? "", "hasTodayForecast":current?["date"] as? String == RabbitStore.today(.now),"solarDays":(currentStatus["solar"] as? [[String:Any]])?.count ?? 0]
    report["stage"] = "finished"
    saveProbe(report)
  }
  private func saveProbe(_ report:[String:Any]) {
    if let data = try? JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]), let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
      try? data.write(to:directory.appendingPathComponent("weather-connection-check.json"),options:.atomic)
    }
  }
  private static func probeError(_ error:Error) -> [String:Any] {
    let error = error as NSError
    var report:[String:Any] = ["success":false,"domain":error.domain,"code":error.code]
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError { report["underlyingDomain"] = underlying.domain; report["underlyingCode"] = underlying.code }
    return report
  }
  #endif

}

@MainActor private final class WeatherRequestGate<T> {
  private var continuation: CheckedContinuation<T,Error>?
  var work:Task<Void,Never>?, timer:Task<Void,Never>?
  init(_ continuation:CheckedContinuation<T,Error>) { self.continuation = continuation }
  func finish(_ result:Result<T,Error>) {
    guard let pending = continuation else { return }
    continuation = nil; work?.cancel(); timer?.cancel(); work = nil; timer = nil
    pending.resume(with:result)
  }
}
