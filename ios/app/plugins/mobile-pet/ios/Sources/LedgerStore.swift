import Foundation

struct LedgerCategory: Codable { var id: String; var name: String; var emoji: String; var kind: String; var archived: Bool = false }
struct LedgerEntry: Codable { var id: String; var type: String; var cents: Int64; var date: String; var categoryId: String; var note: String }
struct LedgerBudget: Codable { var month: String; var categoryId: String; var cents: Int64 }
struct LedgerDocument: Codable {
  var version = 1
  var revision: Int64 = 0
  var budgets: [LedgerBudget]? = nil
  var entries: [LedgerEntry] = []
  var categories: [LedgerCategory] = [
    .init(id: "food", name: "餐食", emoji: "🍚", kind: "out"), .init(id: "drink", name: "饮品", emoji: "🥤", kind: "out"),
    .init(id: "travel", name: "交通", emoji: "🚇", kind: "out"), .init(id: "shopping", name: "购物", emoji: "🛍", kind: "out"),
    .init(id: "daily", name: "日用", emoji: "🧺", kind: "out"), .init(id: "fun", name: "娱乐", emoji: "🎧", kind: "out"),
    .init(id: "support", name: "应援", emoji: "⭐", kind: "out"), .init(id: "salary", name: "工资", emoji: "💼", kind: "in"),
    .init(id: "gift", name: "收到礼物", emoji: "🎁", kind: "in"), .init(id: "refund", name: "退款", emoji: "↩️", kind: "in")
  ]
}
struct LedgerRequest: Decodable { var operation: String; var revision: Int64?; var entry: LedgerEntry?; var category: LedgerCategory?; var id: String?; var budget: LedgerBudget? }
struct LedgerFailure: LocalizedError { var message: String; var errorDescription: String? { message } }

/// A separate file and atomic transactions keep accounting independent of
/// chats, reminders and widgets. Integer cents avoid floating-point money.
final class LedgerStore {
  static let shared = LedgerStore(directory: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("SanhaoLedger", isDirectory: true))
  private let directory: URL
  private let lock = NSLock()
  init(directory: URL) { self.directory = directory }
  private func read() throws -> LedgerDocument {
    let file = directory.appendingPathComponent("ledger-v1.json")
    guard FileManager.default.fileExists(atPath: file.path) else { return .init() }
    let value = try JSONDecoder().decode(LedgerDocument.self, from: Data(contentsOf: file))
    guard value.version == 1 else { throw LedgerFailure(message: "账本版本暂不支持，原记录没有修改") }
    return value
  }
  func handle(_ data: Data) throws -> LedgerDocument {
    let request = try JSONDecoder().decode(LedgerRequest.self, from: data)
    lock.lock(); defer { lock.unlock() }
    var state = try read()
    if request.operation == "read" { return state }
    guard request.revision == state.revision else { throw LedgerFailure(message: "账本已更新，请返回后重新打开再保存") }
    switch request.operation {
    case "clearEntries": state.entries = []
    case "saveEntry":
      guard let entry = request.entry, !entry.id.isEmpty, entry.id.count <= 100, ["out", "in"].contains(entry.type), entry.cents > 0, entry.cents <= 999_999_999_999,
        entry.note.count <= 200, validDate(entry.date), let category = state.categories.first(where: { $0.id == entry.categoryId }), category.kind == entry.type || category.kind == "both"
      else { throw LedgerFailure(message: "请检查金额、日期和分类") }
      if let index = state.entries.firstIndex(where: { $0.id == entry.id }) { state.entries[index] = entry }
      else { guard state.entries.count < 100_000, !category.archived else { throw LedgerFailure(message: "这个分类已收起，请换一个分类") }; state.entries.append(entry) }
    case "deleteEntry":
      guard let id = request.id, state.entries.contains(where: { $0.id == id }) else { throw LedgerFailure(message: "没有找到这条账目") }
      state.entries.removeAll { $0.id == id }
    case "saveCategory":
      guard var category = request.category, !category.id.isEmpty, category.id.count <= 100, ["in", "out", "both"].contains(category.kind) else { throw LedgerFailure(message: "分类信息不完整") }
      category.name = category.name.trimmingCharacters(in: .whitespacesAndNewlines)
      category.emoji = category.emoji.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !category.name.isEmpty, category.name.count <= 12, !category.emoji.isEmpty, category.emoji.count <= 4 else { throw LedgerFailure(message: "写一个分类名，再选一个 emoji 呀") }
      if let index = state.categories.firstIndex(where: { $0.id == category.id }) {
        if state.entries.contains(where: { $0.categoryId == category.id && $0.type != category.kind }) && category.kind != "both" { throw LedgerFailure(message: "已有账目的分类不能改成另一种收支类型") }
        state.categories[index] = category
      } else { guard state.categories.count < 1000 else { throw LedgerFailure(message: "分类数量太多啦") }; state.categories.append(category) }
    case "saveBudget":
      guard let b = request.budget, b.month.range(of:"^\\d{4}-(0[1-9]|1[0-2])$",options:.regularExpression) != nil, b.cents >= 0, b.cents <= 999_999_999_999,
        b.categoryId.isEmpty || state.categories.contains(where:{$0.id == b.categoryId && ["out","both"].contains($0.kind)}) else { throw LedgerFailure(message:"请检查预算金额、月份和分类") }
      state.budgets = (state.budgets ?? []).filter { $0.month != b.month || $0.categoryId != b.categoryId }
      if b.cents > 0 { state.budgets!.append(b) }
    case "archiveCategory":
      guard let id = request.id, let index = state.categories.firstIndex(where: { $0.id == id }) else { throw LedgerFailure(message: "没有找到这个分类") }
      state.categories[index].archived = true
    default: throw LedgerFailure(message: "不支持这个账本操作")
    }
    state.revision += 1
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try JSONEncoder().encode(state).write(to: directory.appendingPathComponent("ledger-v1.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    return state
  }
  private func validDate(_ value: String) -> Bool {
    guard Int(value.prefix(4)).map({ $0 >= 1000 }) == true, value.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil else { return false }
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(secondsFromGMT: 0); f.dateFormat = "yyyy-MM-dd"; f.isLenient = false
    return f.date(from: value).map { f.string(from: $0) == value } ?? false
  }
}
