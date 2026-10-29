import Foundation

struct DailySettings: Codable {
  var enabled = true
  var message = "今天好好吃饭了嘛？"
  var hour = 20
  var minute = 0
  var lastShownDate = ""
  var answerDate = ""
  var answer = ""
}
struct MemoRequest: Codable {
  let id: String
  let title: String
  let kind: String
  let reminderId: String
  let completed: Bool
  let triggerAt: Double
  let message: String
  let date: String?
  let time: String?
}
struct FocusRequest: Codable {
  let deadline: Double
  let message: String
  let leadMinutes: Int
}
struct ReminderStyle: Codable {
  var popup = true
  var vibration = false
  var sound = false
  var rhythm = "double"
  var tone = "gentle"
  var soundSeconds = 15
  var vibrationSeconds = 15
}
struct PlannedReminder {
  let identifier: String
  let kind: String
  let reminderId: String
  let message: String
  let date: Date
  let eventId: String
  var repeatsDaily = false
  var repeatsWeekly = false
}
enum MealReminderCopy {
  // Original app copy inspired by the user's requested expression families;
  // these are not quotations. Keep each meal explicit and one tic per message.
  static let choices: [String:[String]] = [
    "breakfast": [
      "aiya，早餐时间到啦，让兔兔帮你挑一份早餐吧",
      "早餐想吃什么呀，兔兔陪你挑个热乎的",
      "来吃早餐咯，选择困难就交给兔兔",
      "早餐记得吃捏，兔兔帮你决定吃什么",
      "今天滴早餐还没想好？让兔兔帮你选一份",
      "早餐吃饱再出发，兔兔来帮忙挑，hiahia",
      "早呀，先给早餐留一点点时间，兔兔陪你选",
      "早餐时间来啦，兔兔帮你挑个喜欢的",
      "早餐吃什么嘛，来让兔兔出个主意",
      "嘿嘿，兔兔来叫你吃早餐，顺便帮你选一份"
    ],
    "lunch": [
      "aiya，到午餐时间了，兔兔帮你决定中午吃什么吧",
      "午餐想吃什么呀，兔兔陪你选一份",
      "先歇一下下吃午餐，让兔兔帮你挑",
      "午餐别忘了捏，纠结吃什么就来找兔兔",
      "午餐吃什么还没想好？兔兔来帮你决定嘛",
      "午餐时间到，兔兔已经准备好帮你选啦",
      "来吃午餐咯，兔兔给你出个主意",
      "hiahia，午餐吃点喜欢的，让兔兔帮你挑",
      "忙完这一小段就吃午餐吧，兔兔陪你选",
      "午餐吃饱一点喔，兔兔帮你决定吃什么"
    ],
    "dinner": [
      "aiya，晚餐时间到了，兔兔帮你挑今晚吃什么吧",
      "晚餐想吃什么呀，兔兔陪你慢慢选",
      "来吃晚餐咯，兔兔给你出个主意",
      "晚餐也要好好吃捏，让兔兔帮你决定",
      "今晚滴晚餐选好了吗，没想好就交给兔兔",
      "hiahia，晚餐吃点喜欢的，兔兔陪你挑",
      "到晚餐时间啦，先把肚子照顾好，兔兔帮你选",
      "晚餐吃什么嘛，来和兔兔一起决定",
      "晚餐留一点点时间慢慢吃，兔兔帮你挑一份",
      "嘿嘿，兔兔来叫你吃晚餐，选菜单也可以帮忙"
    ]
  ]
}
enum ReminderPlan {
  static func today(_ date: Date = Date(), calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
  }
  static func make(daily: DailySettings, memos: [MemoRequest], focus: FocusRequest?, now: Date = Date(), calendar: Calendar = .current) -> [PlannedReminder] {
    var result: [PlannedReminder] = []
    func add(_ id: String, _ kind: String, _ reminderId: String, _ message: String, _ date: Date, eventId: String? = nil, repeatsDaily: Bool = false, repeatsWeekly: Bool = false) {
      guard date > now else { return }
      result.append(PlannedReminder(identifier: "hhxx." + id, kind: kind, reminderId: reminderId,
        message: message, date: date, eventId: eventId ?? String(Int64((date.timeIntervalSince1970 * 1000).rounded())), repeatsDaily: repeatsDaily, repeatsWeekly: repeatsWeekly))
    }
    // A bounded rolling queue lets completion cancel today's prompt without
    // background execution. Opening the app refreshes the next 30 days.
    if daily.enabled {
      for offset in 0..<30 {
        guard let day = calendar.date(byAdding: .day, value: offset, to: now),
          let date = calendar.date(bySettingHour: daily.hour, minute: daily.minute, second: 0, of: day) else { continue }
        if offset == 0 && daily.answerDate == today(now, calendar: calendar) && daily.answer == "done" { continue }
        add("daily." + today(day, calendar: calendar), "daily", "", daily.message, date)
      }
    }
    for memo in memos where !memo.completed && memo.triggerAt.isFinite && memo.triggerAt > 0 {
      let date = Date(timeIntervalSince1970: memo.triggerAt / 1000)
      let kind = ["countdown","course","habit","meal"].contains(memo.kind) ? memo.kind : "todo"
      if kind == "meal" {
        let clock = memo.time ?? ""
        let parts = clock.split(separator: ":").compactMap { Int($0) }
        guard clock.range(of:"^([01][0-9]|2[0-3]):[0-5][0-9]$",options:.regularExpression) != nil, parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]),
          let pool = MealReminderCopy.choices[memo.reminderId], pool.count >= 7 else { continue }
        // Seven distinct weekly triggers keep daily copy varied even while the
        // app is closed. Rescheduling reshuffles; no background text generation
        // or model download is needed for meal reminders.
        let messages=Array(pool.shuffled().prefix(7))
        for weekday in 1...7 {
          var match=DateComponents();match.weekday=weekday;match.hour=parts[0];match.minute=parts[1]
          guard let next=calendar.nextDate(after:now,matching:match,matchingPolicy:.nextTime) else { continue }
          add("meal.\(memo.reminderId).\(weekday)",kind,memo.reminderId,messages[weekday-1],next,repeatsWeekly:true)
        }
        continue
      }
      if kind == "todo" && (memo.date ?? "").isEmpty {
        // An undated task is a daily task. Calendar arithmetic preserves its
        // wall clock time across daylight saving changes.
        for offset in 0..<30 {
          if let next = calendar.date(byAdding: .day, value: offset, to: date) {
            add("memo.\(memo.id).\(today(next, calendar: calendar))", kind, memo.reminderId, memo.message, next)
          }
        }
      } else { add("memo." + memo.id, kind, memo.reminderId, memo.message, date) }
    }
    if let focus = focus {
      let date = Date(timeIntervalSince1970: focus.deadline / 1000)
      let event = String(Int64(focus.deadline.rounded()))
      add("focus.end", "focus", "", focus.message, date, eventId: event)
      if focus.leadMinutes > 0 {
        add("focus.lead", "focus", "", "还有 \(focus.leadMinutes) 分钟，慢慢收尾吧。",
          date.addingTimeInterval(-Double(focus.leadMinutes * 60)), eventId: event + "-lead")
      }
    }
    return result.sorted { $0.date == $1.date ? $0.identifier < $1.identifier : $0.date < $1.date }
  }
  static func select(_ plan:[PlannedReminder], capacity:Int) -> [PlannedReminder] {
    let limit=max(0,capacity)
    let recurring=plan.filter{$0.kind=="meal" && $0.repeatsWeekly}
    let rest=plan.filter{!($0.kind=="meal" && $0.repeatsWeekly)}
    return Array((recurring+rest).prefix(limit)).sorted{$0.date < $1.date}
  }
}
