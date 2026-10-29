import Foundation

struct HealthMeal: Codable { var id: String; var date: String; var kind: String; var text: String }
struct HealthWeight: Codable { var date: String; var grams: Int }
struct HealthExercise: Codable { var id: String; var date: String; var name: String; var minutes: Int; var note: String }
struct HealthHabit: Codable { var id: String; var name: String; var emoji: String; var archived: Bool; var days: [Int]? = nil; var weeklyTarget: Int? = nil }
let fixedHealthHabits: [HealthHabit] = [.init(id: "water", name: "喝水", emoji: "💧", archived: false), .init(id: "exercise", name: "运动", emoji: "🏃", archived: false)]
struct HealthCheckin: Codable { var habitId: String; var date: String }
struct HealthDocument: Codable {
  var version = 1; var revision: Int64 = 0
  var meals: [HealthMeal] = []; var weights: [HealthWeight] = []; var exercises: [HealthExercise] = []
  var habits: [HealthHabit] = fixedHealthHabits; var checkins: [HealthCheckin] = []
}
struct HealthRequest: Decodable {
  var operation: String; var revision: Int64?; var meal: HealthMeal?; var weight: HealthWeight?
  var exercise: HealthExercise?; var habit: HealthHabit?; var id: String?; var date: String?; var checked: Bool?
}
struct HealthFailure: LocalizedError { var message: String; var errorDescription: String? { message } }

/// Local, protected storage only; never sends health or habit records externally.
final class HealthStore {
  static let shared = HealthStore(directory: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("SanhaoHealth", isDirectory: true))
  private let directory: URL; private let lock = NSLock()
  init(directory: URL) { self.directory = directory }
  func handle(_ data: Data) throws -> HealthDocument {
    let r = try JSONDecoder().decode(HealthRequest.self, from: data)
    lock.lock(); defer { lock.unlock() }
    let file = directory.appendingPathComponent("health-v1.json")
    var s = FileManager.default.fileExists(atPath: file.path) ? try JSONDecoder().decode(HealthDocument.self, from: Data(contentsOf: file)) : HealthDocument()
    guard s.version == 1 else { throw HealthFailure(message: "记录版本暂不支持，原数据没有修改") }
    s.habits = fixedHealthHabits + s.habits.filter { item in !fixedHealthHabits.contains(where: { $0.id == item.id }) }
    if r.operation == "read" { return s }
    guard r.revision == s.revision else { throw HealthFailure(message: "记录已更新，请返回后重新打开再保存") }
    func require(_ condition: Bool, _ text: String) throws { if !condition { throw HealthFailure(message: text) } }
    switch r.operation {
    case "clearHealthRecords": s.meals = []; s.weights = []; s.exercises = []
    case "clearCheckins": s.checkins = []
    case "saveMeal":
      guard var v = r.meal else { throw HealthFailure(message: "写一点餐食内容呀") }; v.text = v.text.trimmingCharacters(in: .whitespacesAndNewlines)
      try require(validID(v.id) && validDate(v.date) && ["breakfast", "lunch", "dinner", "snack"].contains(v.kind) && !v.text.isEmpty && v.text.count <= 500, "请检查餐食内容和日期")
      if let i = s.meals.firstIndex(where: { $0.id == v.id }) { s.meals[i] = v } else { s.meals.append(v) }
    case "saveWeight":
      guard let v = r.weight else { throw HealthFailure(message: "记一个体重呀") }
      try require(validDate(v.date) && v.grams > 0 && v.grams <= 1_000_000 && v.grams % 10 == 0, "体重用千克填写，最多两位小数")
      if let i = s.weights.firstIndex(where: { $0.date == v.date }) { s.weights[i] = v } else { s.weights.append(v) }
    case "saveExercise":
      guard var v = r.exercise else { throw HealthFailure(message: "写一个运动名称呀") }; v.name = v.name.trimmingCharacters(in: .whitespacesAndNewlines)
      try require(validID(v.id) && validDate(v.date) && !v.name.isEmpty && v.name.count <= 30 && v.minutes > 0 && v.minutes <= 1440 && v.note.count <= 200, "请检查运动名称、时长和日期")
      if let i = s.exercises.firstIndex(where: { $0.id == v.id }) { s.exercises[i] = v } else { s.exercises.append(v) }
    case "saveHabit":
      guard var v = r.habit else { throw HealthFailure(message: "写一个习惯名称呀") }; v.name = v.name.trimmingCharacters(in: .whitespacesAndNewlines); v.emoji = v.emoji.trimmingCharacters(in: .whitespacesAndNewlines)
      if let fixed = fixedHealthHabits.first(where: { $0.id == v.id }) { try require(v.name == fixed.name && v.emoji == fixed.emoji && !v.archived, "喝水和运动是固定习惯，不能修改或收起") }
      try require(validID(v.id) && !v.name.isEmpty && v.name.count <= 20 && !v.emoji.isEmpty && v.emoji.count <= 4, "习惯名称最多 20 字，再选一个 emoji 呀")
      if let days = v.days { try require(!days.isEmpty && days.allSatisfy { (1...7).contains($0) } && Set(days).count == days.count,"每周至少选一天，日期不能重复") }
      if let target = v.weeklyTarget { try require(target >= 1 && target <= (v.days?.count ?? 7),"每周目标不能超过选择的天数") }
      if let i = s.habits.firstIndex(where: { $0.id == v.id }) { s.habits[i] = v } else { s.habits.append(v) }
    case "setCheckin":
      guard let id = r.id, let date = r.date, let checked = r.checked, let habit = s.habits.first(where: { $0.id == id }) else { throw HealthFailure(message: "没有找到这个习惯") }
      try require(validDate(date) && !habit.archived, "这个习惯已收起或日期无效")
      s.checkins.removeAll { $0.habitId == id && $0.date == date }
      if checked { s.checkins.append(.init(habitId: id, date: date)) }
    case "archiveHabit":
      try require(!fixedHealthHabits.contains(where: { $0.id == r.id }), "喝水和运动是固定习惯，不能收起")
      guard let id = r.id, let i = s.habits.firstIndex(where: { $0.id == id }) else { throw HealthFailure(message: "没有找到这个习惯") }; s.habits[i].archived = true
    case "deleteMeal": try require(s.meals.contains { $0.id == r.id }, "没有找到这条餐食"); s.meals.removeAll { $0.id == r.id }
    case "deleteExercise": try require(s.exercises.contains { $0.id == r.id }, "没有找到这条运动"); s.exercises.removeAll { $0.id == r.id }
    case "deleteWeight": try require(s.weights.contains { $0.date == r.date }, "没有找到这个体重"); s.weights.removeAll { $0.date == r.date }
    default: throw HealthFailure(message: "不支持这个操作")
    }
    try require(s.meals.count + s.weights.count + s.exercises.count + s.checkins.count < 200_000 && s.habits.count <= 1000, "记录数量太多啦")
    s.revision += 1
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try JSONEncoder().encode(s).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    return s
  }
  private func validID(_ v: String) -> Bool { !v.isEmpty && v.count <= 100 }
  private func validDate(_ v: String) -> Bool {
    guard Int(v.prefix(4)).map({ $0 >= 1000 }) == true, v.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil else { return false }
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(secondsFromGMT: 0); f.dateFormat = "yyyy-MM-dd"; f.isLenient = false
    return f.date(from: v).map { f.string(from: $0) == v } ?? false
  }
}
