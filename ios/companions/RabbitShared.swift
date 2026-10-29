import Foundation
import Darwin

// Same public model is compiled into the app and its extension. Real records
// stay owned by the app; widgets queue explicit, dated todo commands only.
struct RabbitRecord: Codable, Identifiable {
  var id: String
  var title: String
  var body: String?
  var date: String?
  var time: String?
  var completedDate: String?
  var updatedAt: String?
  var kind: String?
}
struct RabbitDailyReply: Codable { var enabled: Bool; var done: Bool; var question: String }
struct RabbitWeatherReport: Codable { var date: String; var low: Double; var high: Double; var advice: String }
struct RabbitSnapshot: Codable {
  var todos: [RabbitRecord] = []
  var days: [RabbitRecord] = []
  var notes: [RabbitRecord] = []
  var moments: [RabbitRecord] = []
  var updatedAt: String = ""
  var daily: RabbitDailyReply? = nil
}
struct RabbitPetState: Codable {
  var mood = "idle"
  var message = "今天也陪在你身边"
  var affection = 0
  var carrots = 0
  var lastAction = ""
  var liveActionToken: String? = nil
  var liveActionStartedAt: Date? = nil
  var recent: [String]? = nil
}
struct RabbitTodoAction: Codable, Identifiable {
  var id: String
  var recordID: String
  var date: String
  var completed: Bool
}
struct RabbitMealState: Codable {
  static let defaults = ["葱烧鸡腿饭", "番茄肉酱拌饭", "土豆胡萝卜牛腩饭", "广式腊味煲仔饭", "扬州炒饭", "黑椒牛肉焗饭", "番茄金针菇烫饭", "培根蘑菇烩饭", "肥牛煎蛋拌饭", "海苔鸡肉炒饭", "老北京炸酱面", "陕西臊子面", "宁波三鲜面", "孜然炒面", "梅州腌面", "酸辣拌面", "番茄虾仁汤面", "葱油拌面", "青菜鸡蛋汤面", "重庆小面"]
  var items = defaults
  var lastChoice = ""
}
struct RabbitWeatherSettings: Codable, Equatable {
  var enabled = false
  var autoLights: Bool? = nil
  var lightsEnabled: Bool { autoLights == true }
  var time = "08:00"
  var times: [String]? = nil
  var rules: [String]? = nil
  var reminderTimes: [String] {
    let values = (times ?? [time]).filter { value in
      let parts = value.split(separator: ":").compactMap { Int($0) }
      return value.count == 5 && parts.count == 2 && (0...23).contains(parts[0]) && (0...59).contains(parts[1])
    }
    let unique = Array(Set(values)).sorted()
    return unique.isEmpty ? ["08:00"] : Array(unique.prefix(6))
  }
  var reminderRules: [String] { rules ?? ["cold", "heat", "rain", "sunWind"] }
}
struct RabbitLiveStyle: Codable, Hashable {
  var background = "#fff1f6"
  var bubble = "#fff7e2"
  var buttons = "#ffebf2"
  var islandBubble = "#fff7e2"
  var islandButtons = "#ffebf2"
  init(background: String = "#fff1f6", bubble: String = "#fff7e2", buttons: String = "#ffebf2", islandBubble: String = "#fff7e2", islandButtons: String = "#ffebf2") {
    self.background = background; self.bubble = bubble; self.buttons = buttons; self.islandBubble = islandBubble; self.islandButtons = islandButtons
  }
  private enum CodingKeys: String, CodingKey { case background, bubble, buttons, islandBubble, islandButtons }
  init(from decoder: Decoder) throws {
    let v = try decoder.container(keyedBy: CodingKeys.self)
    background = try v.decodeIfPresent(String.self, forKey: .background) ?? "#fff1f6"
    bubble = try v.decodeIfPresent(String.self, forKey: .bubble) ?? "#fff7e2"
    buttons = try v.decodeIfPresent(String.self, forKey: .buttons) ?? "#ffebf2"
    islandBubble = try v.decodeIfPresent(String.self, forKey: .islandBubble) ?? "#fff7e2"
    islandButtons = try v.decodeIfPresent(String.self, forKey: .islandButtons) ?? "#ffebf2"
  }
  func normalized() -> RabbitLiveStyle {
    let defaults = RabbitLiveStyle()
    func color(_ value: String, _ fallback: String) -> String {
      value.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil ? value.lowercased() : fallback
    }
    return RabbitLiveStyle(background: color(background, defaults.background), bubble: color(bubble, defaults.bubble), buttons: color(buttons, defaults.buttons), islandBubble: color(islandBubble, defaults.islandBubble), islandButtons: color(islandButtons, defaults.islandButtons))
  }
}
struct RabbitSharedState: Codable {
  var snapshot = RabbitSnapshot()
  var pet = RabbitPetState()
  var pending: [RabbitTodoAction] = []
  var meal = RabbitMealState()
  var weather: RabbitWeatherReport? = nil
  var liveStyle = RabbitLiveStyle()
  var focusLane = RabbitFocusLane()
  var focusInputRevision: UInt64 = 0
  init(snapshot: RabbitSnapshot = .init(), pet: RabbitPetState = .init(), pending: [RabbitTodoAction] = [], meal: RabbitMealState = .init()) {
    self.snapshot = snapshot; self.pet = pet; self.pending = pending; self.meal = meal
  }
  enum CodingKeys: String, CodingKey { case snapshot, pet, pending, meal, weather, liveStyle, focusLane, focusInputRevision }
  init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    snapshot = try values.decodeIfPresent(RabbitSnapshot.self, forKey: .snapshot) ?? .init()
    pet = try values.decodeIfPresent(RabbitPetState.self, forKey: .pet) ?? .init()
    pending = try values.decodeIfPresent([RabbitTodoAction].self, forKey: .pending) ?? []
    meal = try values.decodeIfPresent(RabbitMealState.self, forKey: .meal) ?? .init()
    weather = try values.decodeIfPresent(RabbitWeatherReport.self, forKey: .weather)
    liveStyle = (try values.decodeIfPresent(RabbitLiveStyle.self, forKey: .liveStyle) ?? .init()).normalized()
    focusLane = try values.decodeIfPresent(RabbitFocusLane.self, forKey:.focusLane) ?? .init()
    focusInputRevision = try values.decodeIfPresent(UInt64.self, forKey:.focusInputRevision) ?? 0
  }
}
struct RabbitFocusInput: Decodable {
  var revision: UInt64
  var id: String
  var phase: String
  var deadlineMs: Double
  var remainingMs: Int
  func apply(to state:inout RabbitSharedState) {
    guard revision > state.focusInputRevision else { return }
    state.focusInputRevision = revision
    let old=state.focusLane.session
    let now=Date.now
    let end=Date(timeIntervalSince1970:deadlineMs/1000)
    let running=phase == "running" && end > now
    let paused=phase == "paused" && remainingMs > 0
    let caption=old?.id == id ? old!.caption : RabbitFocusCaptions.choose(excluding:old?.caption,randomIndex:{Int.random(in:0..<$0)})
    let session:RabbitFocusSession? = running || paused ? .init(id:id,phase:running ? .running : .paused,
      startedAt:now,deadline:end,remainingMilliseconds:max(0,remainingMs),caption:caption) : nil
    state.focusLane.apply(.init(version:state.focusLane.version+1,session:session))
  }
}
struct RabbitSyncRequest: Decodable {
  var snapshot: RabbitSnapshot
  var acknowledged: [String]
  var petAction: String?
  var petMessage: String?
  var meals: [String]?
  var weather: RabbitWeatherSettings?
  var followEnabled: Bool?
  var weatherRefresh: Bool?
  var liveStyle: RabbitLiveStyle?
  var focus: RabbitFocusInput?
}
enum RabbitStore {
  static let group = "group.com.hikovo.sanhaotu.companion"
  static var sharedAvailable: Bool { Bundle.main.object(forInfoDictionaryKey: "RabbitSharedRecordsEnabled") as? Bool == true && FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil }
  static var directory: URL {
    if sharedAvailable, let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) { return url }
    // Free signing: pet interactions remain usable in the widget extension.
    // Never pretend this extension-local fallback contains the app's records.
    return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("RabbitCompanion", isDirectory: true)
  }
  static func transaction<T>(_ body: (inout RabbitSharedState) throws -> T) throws -> T {
    let folder = directory
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let descriptor = open(folder.appendingPathComponent("state.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw CocoaError(.fileWriteNoPermission) }
    defer { flock(descriptor, LOCK_UN); close(descriptor) }
    guard flock(descriptor, LOCK_EX) == 0 else { throw CocoaError(.fileWriteUnknown) }
    let file = folder.appendingPathComponent("state-v1.json")
    var state = RabbitSharedState()
    if sharedAvailable && Bundle.main.bundleIdentifier == "com.hikovo.sanhaotu" && !FileManager.default.fileExists(atPath: file.path) {
      let old = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("RabbitCompanion/state-v1.json")
      if FileManager.default.fileExists(atPath: old.path) { state = try JSONDecoder().decode(RabbitSharedState.self, from: Data(contentsOf: old)) }
    }
    if FileManager.default.fileExists(atPath: file.path) { state = try JSONDecoder().decode(RabbitSharedState.self, from: Data(contentsOf: file)) }
    let result = try body(&state)
    try JSONEncoder().encode(state).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    return result
  }
  static func read() throws -> RabbitSharedState { try transaction { $0 } }
  static func today(_ date: Date = .now) -> String {
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; return formatter.string(from: date)
  }
  static func act(_ action: String, pet: inout RabbitPetState) {
    pet.lastAction = ISO8601DateFormatter().string(from: .now)
    switch action {
    case "hop": pet.affection += 1; pet.mood = "hop"; pet.message = "跳跳，今天也陪着你"
    case "wink": pet.affection += 1; pet.mood = "wink"; pet.message = "wink～"
    case "dizzy": pet.affection += 1; pet.mood = "dizzy"; pet.message = "晕菜啦……"
    case "feed": pet.carrots += 1; pet.mood = "happy"; pet.message = "收到第 \(pet.carrots) 根胡萝卜啦 ♡"
    case "rest": pet.mood = "idle"; pet.message = "休息一下，兔兔陪着你"
    default: pet.affection += 1; pet.mood = "happy"; pet.message = "被摸摸 \(pet.affection) 次啦 ♡"
    }
  }
  static func act(_ action: String, state: inout RabbitSharedState, message: String? = nil) {
    act(action == "captain" ? "wink" : action, pet: &state.pet)
    if ["hop", "wink", "dizzy", "captain"].contains(action) {
      if let message, !message.isEmpty {
        state.pet.message = String(message.prefix(240))
        state.pet.recent = Array(((state.pet.recent ?? []).filter { $0 != message } + [message]).suffix(80))
      } else { state.pet.message = RabbitReplies.choose(action, state: &state) }
    }
  }
  static func setMeals(_ items: [String], state: inout RabbitSharedState) {
    var seen = Set<String>()
    state.meal.items = items.map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40)) }
      .filter { !$0.isEmpty && seen.insert($0).inserted }.prefix(100).map { $0 }
  }
  static func pickMeal(state: inout RabbitSharedState) {
    let choices = state.meal.items.count > 1 ? state.meal.items.filter { $0 != state.meal.lastChoice } : state.meal.items
    guard let choice = choices.randomElement() else { state.pet.message = "先在 App 里加几道喜欢的菜吧"; return }
    state.meal.lastChoice = choice; state.pet.mood = "happy"
    state.pet.message = "今天吃：\(choice)"
    state.pet.lastAction = ISO8601DateFormatter().string(from: .now)
  }
  static func applying(_ commands: [RabbitTodoAction], to snapshot: inout RabbitSnapshot) {
    for command in commands {
      guard let index = snapshot.todos.firstIndex(where: { $0.id == command.recordID }) else { continue }
      snapshot.todos[index].completedDate = command.completed ? command.date : ""
    }
  }
}
