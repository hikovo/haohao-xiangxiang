import AppIntents
import SwiftUI
import WidgetKit

private let rabbitInk = Color(red: 103/255, green: 77/255, blue: 82/255)
private let rabbitPink = Color(red: 202/255, green: 135/255, blue: 148/255)
private let rabbitCream = Color(red: 1, green: 249/255, blue: 239/255)
private let rabbitBlush = Color(red: 1, green: 237/255, blue: 243/255)

enum RabbitMood: String, AppEnum {
  case idle, happy, focus, hop, wink, dizzy
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "兔兔状态"
  static var caseDisplayRepresentations: [RabbitMood: DisplayRepresentation] = [.idle: "休闲", .happy: "开心", .focus: "专注", .hop: "跳跳", .wink: "wink", .dizzy: "晕晕"]
  var asset: String { switch self { case .idle: "RabbitIdle"; case .happy: "RabbitHappy"; case .focus: "RabbitFocus"; case .hop: "RabbitHop"; case .wink: "RabbitWink"; case .dizzy: "RabbitDizzy" } }
}
enum RabbitContent: String, AppEnum {
  case todo, anniversary, countdown, note, moment, none
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "记录内容"
  static var caseDisplayRepresentations: [RabbitContent: DisplayRepresentation] = [
    .todo: "待办事项", .anniversary: "纪念日", .countdown: "倒数日", .note: "便签本", .moment: "碎碎念", .none: "不显示第二组"
  ]
  var title: String { switch self { case .todo: "待办事项"; case .anniversary: "纪念日"; case .countdown: "倒数日"; case .note: "便签本"; case .moment: "碎碎念"; case .none: "" } }
  var symbol: String { switch self { case .todo: "checklist"; case .anniversary: "heart"; case .countdown: "hourglass"; case .note: "note.text"; case .moment: "quote.bubble"; case .none: "circle" } }
  var recordsKind: String { switch self { case .anniversary, .countdown: rawValue; case .moment: "moment"; case .note: "note"; default: "todo" } }
}
enum RabbitRoom: String, AppEnum {
  case room, pink, cream
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "兔兔背景"
  static var caseDisplayRepresentations: [RabbitRoom: DisplayRepresentation] = [.room: "温暖小房间", .pink: "淡粉小角落", .cream: "奶油小角落"]
}
enum RabbitPrimaryContent: String, AppEnum {
  case todo, anniversary, countdown, note, moment
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "主要记录内容"
  static var caseDisplayRepresentations: [RabbitPrimaryContent: DisplayRepresentation] = [
    .todo: "待办事项", .anniversary: "纪念日", .countdown: "倒数日", .note: "便签本", .moment: "碎碎念"
  ]
}
struct RabbitConfiguration: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "互动兔兔"
  static var description = IntentDescription("跳跳、wink、晕晕，把兔兔放进喜欢的小角落。")
  @Parameter(title: "兔兔状态", default: .idle) var mood: RabbitMood
  @Parameter(title: "背景", default: .room) var room: RabbitRoom
  init() { mood = .idle; room = .room }
}
struct RabbitRecordEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "App 中的记录"
  static var defaultQuery = RabbitRecordQuery()
  var id: String
  var title: String
  var kind: String
  var displayRepresentation: DisplayRepresentation { .init(title: "\(title)", subtitle: "\(kind)") }
}
struct RabbitRecordQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [RabbitRecordEntity] { try all().filter { identifiers.contains($0.id) } }
  func entities(matching string: String) async throws -> [RabbitRecordEntity] { try all().filter { $0.title.localizedCaseInsensitiveContains(string) } }
  func suggestedEntities() async throws -> [RabbitRecordEntity] { try all() }
  private func all() throws -> [RabbitRecordEntity] {
    guard RabbitStore.sharedAvailable else { return [] }
    let snapshot = try RabbitStore.read().snapshot
    return snapshot.todos.map { .init(id: "todo:\($0.id)", title: $0.title, kind: "待办") }
      + snapshot.days.map { .init(id: "\($0.kind ?? "countdown"):\($0.id)", title: $0.title, kind: $0.kind == "anniversary" ? "纪念日" : "倒数日") }
      + snapshot.notes.map { .init(id: "note:\($0.id)", title: $0.title, kind: "便签") }
      + snapshot.moments.map { .init(id: "moment:\($0.id)", title: String(($0.body ?? "").prefix(24)), kind: "碎碎念") }
  }
}
struct RabbitBoardConfiguration: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "兔兔的记录卡"
  static var description = IntentDescription("选择一种内容，或指定一条记录。留空时显示最近的记录。")
  @Parameter(title: "主要内容", default: .todo) var content: RabbitPrimaryContent
  @Parameter(title: "指定记录（可留空）") var record: RabbitRecordEntity?
}
struct RabbitEntry: TimelineEntry {
  let date: Date
  let state: RabbitSharedState
  let shared: Bool
  let failed: Bool
  var mood: RabbitMood = .idle
  var room: RabbitRoom = .room
  var content: RabbitContent = .todo
  var selected: String?
  var secondary: RabbitContent = .none
}
private func rabbitEntry(at date: Date = .now) -> RabbitEntry {
  do { return RabbitEntry(date: date, state: try RabbitStore.read(), shared: RabbitStore.sharedAvailable, failed: false) }
  catch { return RabbitEntry(date: date, state: .init(), shared: RabbitStore.sharedAvailable, failed: true) }
}
private func nextRefresh(_ entry: RabbitEntry) -> Date {
  // Refresh visible dates without resetting any task completion state.
  Calendar.current.date(byAdding: .minute, value: 30, to: entry.date) ?? entry.date.addingTimeInterval(1800)
}
struct RabbitProvider: AppIntentTimelineProvider {
  // Placeholder generation must be immediate and independent of file locks.
  func placeholder(in context: Context) -> RabbitEntry { RabbitEntry(date: .now, state: .init(), shared: false, failed: false) }
  func snapshot(for configuration: RabbitConfiguration, in context: Context) async -> RabbitEntry {
    let entry = make(configuration); recordHealth(entry, phase: "snapshot"); return entry
  }
  func timeline(for configuration: RabbitConfiguration, in context: Context) async -> Timeline<RabbitEntry> {
    let entry = make(configuration)
    recordHealth(entry, phase: "timeline")
    return Timeline(entries: [entry], policy: .after(nextRefresh(entry)))
  }
  private func recordHealth(_ entry: RabbitEntry, phase: String) {
    #if DEBUG
    let health: [String: Any] = ["provider": "SanhaoRabbitWidget", "phase": phase, "timelineAt": ISO8601DateFormatter().string(from: entry.date), "shared": entry.shared, "readFailed": entry.failed, "room": entry.room.rawValue]
    if let data = try? JSONSerialization.data(withJSONObject: health) {
      try? data.write(to: RabbitStore.directory.appendingPathComponent("small-widget-health.json"), options: .atomic)
    }
    #endif
  }
  private func make(_ configuration: RabbitConfiguration) -> RabbitEntry {
    var entry = rabbitEntry(); entry.mood = configuration.mood; entry.room = configuration.room; return entry
  }
}
struct RabbitBoardProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> RabbitEntry { rabbitEntry() }
  func snapshot(for configuration: RabbitBoardConfiguration, in context: Context) async -> RabbitEntry { make(configuration) }
  func timeline(for configuration: RabbitBoardConfiguration, in context: Context) async -> Timeline<RabbitEntry> {
    let entry = make(configuration)
    let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: entry.date))!
    // Include midnight as an actual entry rather than waiting for a budgeted reload.
    var tomorrow = entry; tomorrow = RabbitEntry(date: midnight, state: entry.state, shared: entry.shared, failed: entry.failed, content: entry.content, selected: entry.selected, secondary: entry.secondary)
    return Timeline(entries: [entry, tomorrow], policy: .after(nextRefresh(entry)))
  }
  private func make(_ configuration: RabbitBoardConfiguration) -> RabbitEntry {
    var entry = rabbitEntry(); entry.content = RabbitContent(rawValue: configuration.content.rawValue) ?? .todo; entry.selected = configuration.record?.id; return entry
  }
}
struct RabbitLargeConfiguration: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "兔兔的每一天"
  static var description = IntentDescription("兔兔和月历固定显示，下面选择一到两组不同记录。")
  @Parameter(title: "主要内容", default: .todo) var content: RabbitPrimaryContent
  @Parameter(title: "指定记录（可留空）") var record: RabbitRecordEntity?
  @Parameter(title: "第二组内容", default: RabbitContent.none) var secondary: RabbitContent
}
struct RabbitLargeProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> RabbitEntry { rabbitEntry() }
  func snapshot(for configuration: RabbitLargeConfiguration, in context: Context) async -> RabbitEntry { make(configuration) }
  func timeline(for configuration: RabbitLargeConfiguration, in context: Context) async -> Timeline<RabbitEntry> {
    let entry = make(configuration)
    let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: entry.date))!
    let next = RabbitEntry(date: midnight, state: entry.state, shared: entry.shared, failed: entry.failed, content: entry.content, selected: entry.selected, secondary: entry.secondary)
    return Timeline(entries: [entry, next], policy: .after(nextRefresh(entry)))
  }
  private func make(_ configuration: RabbitLargeConfiguration) -> RabbitEntry {
    var entry = rabbitEntry(); entry.content = RabbitContent(rawValue: configuration.content.rawValue) ?? .todo; entry.selected = configuration.record?.id
    entry.secondary = configuration.secondary == entry.content ? .none : configuration.secondary
    return entry
  }
}
struct RabbitArt: View {
  var mood: RabbitMood
  var body: some View {
    if #available(iOS 18, *) { Image(mood.asset).resizable().widgetAccentedRenderingMode(.fullColor).scaledToFit() }
    else { Image(mood.asset).resizable().scaledToFit() }
  }
}
struct RabbitPose: View {
  var mood: String
  var frame: Int? = nil
  private var asset: String {
    let counts = ["hop": 4, "wink": 5, "dizzy": 8]
    if let count = counts[mood], let frame, (0..<count).contains(frame) { return "Rabbit" + mood.capitalized + "Frame" + String(frame) }
    return (RabbitMood(rawValue: mood) ?? .idle).asset
  }
  var body: some View {
    if #available(iOS 18, *) { Image(asset).resizable().widgetAccentedRenderingMode(.fullColor).scaledToFit() }
    else { Image(asset).resizable().scaledToFit() }
  }
}
struct RabbitActions: View {
  var compact = false
  var body: some View {
    HStack(spacing: 6) {
      Button(intent: RabbitPetIntent("hop")) { Text("跳跳") }
      Button(intent: RabbitPetIntent("wink")) { Text("wink") }
      Button(intent: RabbitPetIntent("dizzy")) { Text("晕晕") }
    }.font(.system(size: compact ? 11 : 12, weight: .medium))
      .buttonStyle(.plain).foregroundStyle(rabbitInk)
  }
}
struct RabbitSmallView: View {
  let entry: RabbitEntry
  private var mood: RabbitMood {
    guard let actionDate = ISO8601DateFormatter().date(from: entry.state.pet.lastAction), entry.date.timeIntervalSince(actionDate) < 600 else { return entry.mood }
    return RabbitMood(rawValue: entry.state.pet.mood) ?? .idle
  }
  var body: some View {
    GeometryReader { geo in
      ZStack {
        if entry.room == .room { Image("HomeRoom").resizable().scaledToFill().frame(width: geo.size.width, height: geo.size.height).clipped() }
        VStack(spacing: 2) {
          HStack {
            Text(entry.date, format: .dateTime.month().day()).font(.system(size: 11, weight: .medium))
            Spacer(minLength: 0)
            Label("\(entry.state.pet.affection)", systemImage: "heart.fill").font(.system(size: 10))
          }.padding(.horizontal, 10).padding(.top, 9)
          RabbitArt(mood: mood).frame(maxHeight: .infinity)
          Text(entry.state.pet.message).font(.system(size: 10, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
            .padding(.horizontal, 7).padding(.vertical, 2).background(rabbitCream.opacity(0.95), in: Capsule())
          RabbitActions(compact: true).padding(.horizontal, 9).padding(.vertical, 6)
            .background(rabbitCream.opacity(0.96), in: Capsule()).padding(.bottom, 9)
        }
      }
    }.foregroundStyle(rabbitInk)
      .containerBackground(for: .widget) { entry.room == .pink ? rabbitBlush : rabbitCream }
      .environment(\.colorScheme, .light)
      .environment(\.locale, Locale(identifier: "zh_CN"))
  }
}
private func daysFrom(_ value: String, now: Date) -> Int? {
  RabbitCalendarMath.days(from: value, now: now)
}
struct RabbitRecordPanel: View {
  let entry: RabbitEntry
  let content: RabbitContent
  var limit = 3
  var compact = false
  private var records: [RabbitRecord] {
    let snapshot = entry.state.snapshot
    var list: [RabbitRecord]
    switch content {
    case .todo: list = snapshot.todos.sorted { ($0.completedDate?.isEmpty == false ? 1 : 0, $0.time ?? "") < ($1.completedDate?.isEmpty == false ? 1 : 0, $1.time ?? "") }
    case .anniversary, .countdown:
      list = snapshot.days.filter { ($0.kind ?? "countdown") == content.rawValue }.sorted { abs(daysFrom($0.date ?? "", now: entry.date) ?? 99999) < abs(daysFrom($1.date ?? "", now: entry.date) ?? 99999) }
    case .note: list = snapshot.notes.sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }
    case .moment: list = snapshot.moments.sorted { ($0.date ?? "", $0.updatedAt ?? "") > ($1.date ?? "", $1.updatedAt ?? "") }
    case .none: list = []
    }
    if let selection = entry.selected, content == entry.content {
      list = list.filter { content.recordsKind + ":" + $0.id == selection }
    }
    return Array(list.prefix(limit))
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack {
        Label(content.title, systemImage: content.symbol).font(.system(size: 14, weight: .semibold))
        Spacer(minLength: 0)
        if content == .todo {
          let all = entry.state.snapshot.todos
          Text("\(all.filter { $0.completedDate?.isEmpty == false }.count)/\(all.count)").font(.system(size: 11)).foregroundStyle(rabbitPink)
        }
        Button(intent: OpenRabbitRecordIntent(content.recordsKind)) { Image(systemName: "arrow.up.right").font(.system(size: 11)) }.buttonStyle(.plain).accessibilityLabel("打开\(content.title)")
      }
      if entry.failed {
        Text("记录暂时没读到，打开 App 重试").font(.system(size: 12)).foregroundStyle(rabbitPink)
      } else if !entry.shared {
        Text("真实记录同步尚未启用").font(.system(size: 12, weight: .medium))
        Text("打开 App 查看你的\(content.title)").font(.system(size: 11)).foregroundStyle(rabbitPink)
      } else if let selection = entry.selected, content == entry.content, !selection.hasPrefix(content.recordsKind + ":") {
        Text("指定记录属于其他类型，请重新选择").font(.system(size: 12)).foregroundStyle(rabbitPink)
      } else if records.isEmpty {
        Text(content == .todo ? "今天的小事，可以慢慢记" : "还没有这类记录，去写一点吧 ♡").font(.system(size: 12)).foregroundStyle(rabbitPink)
      } else {
        ForEach(records) { record in
          HStack(alignment: .top, spacing: 7) {
            if content == .todo {
              Button(intent: RabbitTodoIntent(id: record.id, date: RabbitStore.today(entry.date))) {
                Image(systemName: record.completedDate?.isEmpty == false ? "checkmark.circle.fill" : "circle").foregroundStyle(rabbitPink).font(.system(size: 18))
              }.buttonStyle(.plain).accessibilityLabel("\(record.completedDate?.isEmpty == false ? "取消完成" : "完成")\(record.title)")
            }
            Button(intent: OpenRabbitRecordIntent(content.recordsKind, id: record.id)) {
              VStack(alignment: .leading, spacing: 3) {
                Text(content == .moment ? (record.body ?? "") : record.title).font(.system(size: 13, weight: .medium)).lineLimit(content == .moment && !compact ? 2 : 1)
                  .strikethrough((content == .todo) && record.completedDate?.isEmpty == false)
                if content == .note { Text(record.body ?? "").font(.system(size: 11)).foregroundStyle(rabbitPink).lineLimit(compact ? 1 : 2) }
                if content == .moment { Text(record.date ?? "").font(.system(size: 10)).foregroundStyle(rabbitPink) }
                if (content == .todo), let time = record.time, !time.isEmpty { Text(time).font(.system(size: 10)).foregroundStyle(rabbitPink) }
                if content == .anniversary || content == .countdown, let days = daysFrom(record.date ?? "", now: entry.date) {
                  Text(days == 0 ? "就是今天 ♡" : days > 0 ? "还有 \(days) 天 · \(record.date ?? "")" : "已经 \(-days) 天 · \(record.date ?? "")")
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(rabbitPink)
                }
              }.frame(maxWidth: .infinity, alignment: .leading)
            }.buttonStyle(.plain)
          }
        }
      }
    }.foregroundStyle(rabbitInk)
  }
}
struct RabbitCalendar: View {
  let date: Date
  private var calendar: Calendar { RabbitCalendarMath.calendar() }
  private var cells: [Int] { RabbitCalendarMath.cells(for: date) }
  var body: some View {
    VStack(spacing: 4) {
      HStack { Text(date, format: .dateTime.year().month()).font(.system(size: 12, weight: .semibold)); Spacer() }
      HStack(spacing: 0) { ForEach(Array(["一", "二", "三", "四", "五", "六", "日"].enumerated()), id: \.offset) { _, label in Text(label).font(.system(size: 9)).frame(maxWidth: .infinity).foregroundStyle(rabbitPink) } }
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
        ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
          Text(day == 0 ? " " : String(day)).font(.system(size: 10, weight: day == calendar.component(.day, from: date) ? .bold : .regular))
            .frame(width: 18, height: 16)
            .background(day == calendar.component(.day, from: date) ? rabbitBlush : .clear, in: Circle())
        }
      }
    }.foregroundStyle(rabbitInk)
  }
}
struct RabbitBoardView: View {
  @Environment(\.widgetFamily) private var systemFamily
  let entry: RabbitEntry
  var previewFamily: WidgetFamily? = nil
  private var family: WidgetFamily { previewFamily ?? systemFamily }
  private var summary: String {
    let data = entry.state.snapshot
    switch entry.content {
    case .todo:
      let remaining = data.todos.filter { $0.completedDate?.isEmpty != false }.count
      return "共 \(data.todos.count) 件小事 · 还剩 \(remaining) 件"
    case .anniversary, .countdown:
      let count = data.days.filter { $0.kind == entry.content.rawValue }.count
      return "记住 \(count) 个重要日子"
    case .note: return "收好 \(data.notes.count) 篇便签"
    case .moment: return "留下 \(data.moments.count) 段碎碎念"
    case .none: return ""
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if family == .systemLarge {
        HStack(alignment: .top, spacing: 12) {
          VStack(spacing: 3) {
            RabbitArt(mood: RabbitMood(rawValue: entry.state.pet.mood) ?? .idle).frame(height: 96)
            Text(entry.state.pet.message).font(.system(size: 10)).lineLimit(1)
            RabbitActions(compact: true).padding(6).background(rabbitBlush, in: Capsule())
          }.frame(maxWidth: .infinity)
          RabbitCalendar(date: entry.date).frame(maxWidth: .infinity)
        }
        RabbitRecordPanel(entry: entry, content: entry.content, limit: entry.secondary == .none ? 3 : 1, compact: entry.secondary != .none)
          .padding(10).background(rabbitBlush.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
        if entry.secondary != .none, entry.secondary != entry.content {
          RabbitRecordPanel(entry: entry, content: entry.secondary, limit: 1, compact: true)
            .padding(10).background(Color.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 12))
        }
      } else {
        HStack {
          Text(entry.date, format: .dateTime.month().day().weekday()).font(.system(size: 11)).foregroundStyle(rabbitPink)
          Spacer()
          Text("兔兔的记录卡").font(.system(size: 11)).foregroundStyle(rabbitPink)
        }
        RabbitRecordPanel(entry: entry, content: entry.content, limit: entry.content == .note || entry.content == .moment ? 1 : 3)
        Spacer(minLength: 0)
        HStack(spacing: 6) {
          RabbitArt(mood: .idle).frame(width: 22, height: 25)
          Text(entry.shared ? summary : "记录仍由 App 好好保管").font(.system(size: 10)).foregroundStyle(rabbitPink)
          Spacer(minLength: 0)
        }
      }
    }.padding(14).foregroundStyle(rabbitInk)
      .containerBackground(for: .widget) { rabbitCream }
      .environment(\.colorScheme, .light)
      .environment(\.locale, Locale(identifier: "zh_CN"))
  }
}
struct SanhaoRabbitWidget: Widget {
  // Keep the old installed kind: existing small widgets survive upgrade.
  let kind = "SanhaoRabbitWidget"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: RabbitConfiguration.self, provider: RabbitProvider()) { RabbitSmallView(entry: $0) }
      .configurationDisplayName("兔兔的小房间 · 2×2")
      .description("有背景的互动兔兔：摸摸、喂喂，记住每一次陪伴。")
      .supportedFamilies([.systemSmall]).contentMarginsDisabled()
  }
}
struct SanhaoRabbitRecordsWidget: Widget {
  let kind = "SanhaoRabbitRecordsWidget"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: RabbitBoardConfiguration.self, provider: RabbitBoardProvider()) { RabbitBoardView(entry: $0) }
      .configurationDisplayName("兔兔的记录卡 · 2×4")
      .description("待办、纪念日、倒数日、便签、碎碎念，选一种喜欢的内容。")
      .supportedFamilies([.systemMedium]).contentMarginsDisabled()
  }
}
struct SanhaoRabbitCalendarWidget: Widget {
  let kind = "SanhaoRabbitCalendarWidget"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: RabbitLargeConfiguration.self, provider: RabbitLargeProvider()) { RabbitBoardView(entry: $0) }
      .configurationDisplayName("兔兔的每一天 · 4×4")
      .description("互动兔兔、月历和一到两组可选记录，一起陪你过每一天。")
      .supportedFamilies([.systemLarge]).contentMarginsDisabled()
  }
}
@main
struct SanhaoRabbitBundle: WidgetBundle {
  var body: some Widget {
    SanhaoRabbitWidget()
    SanhaoRabbitRecordsWidget()
    SanhaoRabbitCalendarWidget()
    RabbitLiveWidget()
  }
}
