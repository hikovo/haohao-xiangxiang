import Foundation

enum RabbitCalendarMath {
  static func calendar(timeZone: TimeZone = .current) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    calendar.firstWeekday = 2
    return calendar
  }
  static func days(from value: String, now: Date, timeZone: TimeZone = .current) -> Int? {
    let formatter = DateFormatter()
    formatter.calendar = calendar(timeZone: timeZone)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = timeZone
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    let text = String(value.prefix(10))
    guard let target = formatter.date(from: text), formatter.string(from: target) == text else { return nil }
    let cal = calendar(timeZone: timeZone)
    return cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: target)).day
  }
  static func cells(for date: Date, timeZone: TimeZone = .current) -> [Int] {
    let cal = calendar(timeZone: timeZone)
    guard let month = cal.date(from: cal.dateComponents([.year, .month], from: date)),
          let range = cal.range(of: .day, in: .month, for: month) else { return [] }
    let offset = (cal.component(.weekday, from: month) + 5) % 7
    return Array(repeating: 0, count: offset) + Array(range) + Array(repeating: 0, count: (7 - (offset + range.count) % 7) % 7)
  }
}
