import Foundation
struct TimetableSlot: Codable { var id: String; var label: String; var start: String; var end: String }
struct TimetableCourse: Codable { var id: String; var name: String; var place: String; var teacher: String; var note: String; var weekday: Int; var start: String; var end: String; var from: String; var until: String; var parity: String; var color: String }
struct StudyTask: Codable { var id: String; var title: String; var courseName: String; var due: String; var done: Bool }
struct TimetableDocument: Codable {
  var version = 1; var revision: Int64 = 0
  static var defaultSlots: [TimetableSlot] { [.init(id:"period-1",label:"1",start:"08:05",end:"08:50"),.init(id:"period-2",label:"2",start:"08:55",end:"09:40"),.init(id:"period-3",label:"3",start:"10:00",end:"10:45"),.init(id:"period-4",label:"4",start:"10:50",end:"11:35"),.init(id:"period-5",label:"5",start:"11:40",end:"12:25"),.init(id:"period-6",label:"6",start:"13:30",end:"14:15"),.init(id:"period-7",label:"7",start:"14:20",end:"15:05"),.init(id:"period-8",label:"8",start:"15:15",end:"16:00"),.init(id:"period-9",label:"9",start:"16:05",end:"16:50"),.init(id:"period-10",label:"10",start:"18:30",end:"19:15"),.init(id:"period-11",label:"11",start:"19:20",end:"20:05"),.init(id:"period-12",label:"12",start:"20:10",end:"20:55"),.init(id:"period-13",label:"13",start:"21:00",end:"21:45")] }
  var slots: [TimetableSlot] = TimetableDocument.defaultSlots
  var courses: [TimetableCourse] = []
  var tasks: [StudyTask]? = nil
  var importedBatches: [String]? = nil
}
struct TimetableRequest: Decodable { var operation: String; var revision: Int64?; var course: TimetableCourse?; var courses: [TimetableCourse]?; var slots: [TimetableSlot]?; var id: String?; var batch: String?; var task: StudyTask? }
struct TimetableFailure: LocalizedError { var message: String; var errorDescription: String? { message } }
final class TimetableStore {
 static let shared = TimetableStore(directory: FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("SanhaoTimetable",isDirectory:true))
 private let directory: URL; private let lock = NSLock()
 init(directory: URL) { self.directory = directory }
 func handle(_ data: Data) throws -> TimetableDocument {
  let r = try JSONDecoder().decode(TimetableRequest.self,from:data)
  lock.lock(); defer { lock.unlock() }
  let file = directory.appendingPathComponent("timetable-v1.json")
  var s = FileManager.default.fileExists(atPath:file.path) ? try JSONDecoder().decode(TimetableDocument.self,from:Data(contentsOf:file)) : TimetableDocument()
  try need(s.version == 1,"课表版本暂不支持，原记录没有修改")
  let legacy = [("morning","上午","08:00","12:00"),("afternoon","下午","14:00","18:00"),("evening","晚上","19:00","21:00")]
  if s.slots.count == legacy.count && zip(s.slots,legacy).allSatisfy({ slot, old in slot.id == old.0 && slot.label == old.1 && slot.start == old.2 && slot.end == old.3 }) { s.slots = TimetableDocument.defaultSlots }
  if r.operation == "read" { return s }
  try need(r.revision == s.revision,"课表已更新，请重新打开再保存")
  func put(_ input: TimetableCourse) throws {
   var c = input; c.name = c.name.trimmingCharacters(in:.whitespacesAndNewlines); c.place = c.place.trimmingCharacters(in:.whitespacesAndNewlines); c.teacher = c.teacher.trimmingCharacters(in:.whitespacesAndNewlines); c.note = c.note.trimmingCharacters(in:.whitespacesAndNewlines)
   try need(validID(c.id) && !c.name.isEmpty && c.name.count <= 80 && c.place.count <= 100 && c.teacher.count <= 60 && c.note.count <= 500,"请检查课程名称、地点和备注")
   try need((1...7).contains(c.weekday) && minute(c.start) >= 0 && minute(c.start) < minute(c.end),"请检查星期和起止时间")
   try need(validDate(c.from) && validDate(c.until) && c.from <= c.until && ["all","odd","even"].contains(c.parity) && (["yellow", "pink", "sage", "blue", "lilac", "peach", "mint", "rose", "cream", "gray", "butter", "apricot", "coral", "mauve", "lavender", "periwinkle", "sky", "seafoam", "olive", "cocoa"].contains(c.color) || c.color.range(of:"^#[0-9a-fA-F]{6}$",options:.regularExpression) != nil),"请检查课程日期和重复方式")
   if r.operation == "importCourses", let linked = s.courses.first(where:{$0.name == c.name && $0.id != c.id}) { c.color = linked.color }
   if let i = s.courses.firstIndex(where:{$0.id == c.id}) { s.courses[i] = c } else { s.courses.append(c) }
  }
  switch r.operation {
  case "clearCourses": s.courses = []; s.tasks = []; s.importedBatches = []
  case "saveStudyTask":
   guard var task = r.task else { throw TimetableFailure(message:"写一件待办吧") }
   task.title = task.title.trimmingCharacters(in:.whitespacesAndNewlines); task.courseName = task.courseName.trimmingCharacters(in:.whitespacesAndNewlines)
   try need(validID(task.id) && !task.title.isEmpty && task.title.count <= 120 && task.courseName.count <= 80 && validDate(task.due),"请检查待办名称、课程和日期")
   var tasks = s.tasks ?? []; if let i = tasks.firstIndex(where:{$0.id == task.id}) { tasks[i] = task } else { tasks.append(task) }
   try need(tasks.count <= 10000,"待办有点多，先整理一下吧"); s.tasks = tasks
  case "deleteStudyTask": try need((s.tasks ?? []).contains(where:{$0.id == r.id}),"没有找到这件待办"); s.tasks = s.tasks?.filter { $0.id != r.id }
  case "saveCourse": guard let c = r.course else { throw TimetableFailure(message:"写一门课程呀") }; try put(c); let name = c.name.trimmingCharacters(in:.whitespacesAndNewlines); for i in s.courses.indices where s.courses[i].name == name { s.courses[i].color = c.color }
  case "importCourses":
   if let batch = r.batch { try need(validID(batch),"导入标记无效"); if s.importedBatches?.contains(batch) == true { return s } }
   guard let courses = r.courses else { throw TimetableFailure(message:"先核对课程呀") }; try need((!courses.isEmpty || r.batch != nil) && courses.count <= 500,"每次导入 1～500 门课程"); for c in courses { try put(c) }; if let batch = r.batch { s.importedBatches = (s.importedBatches ?? []) + [batch] }
  case "deleteCourse": try need(s.courses.contains(where:{$0.id == r.id}),"没有找到这门课程"); s.courses.removeAll(where:{$0.id == r.id})
  case "saveSlots":
   guard var slots = r.slots else { throw TimetableFailure(message:"先写时间段呀") }; try need(!slots.isEmpty && slots.count <= 40,"请保留 1～40 个时间段")
   slots.sort { minute($0.start) < minute($1.start) }
   for i in slots.indices { slots[i].label = slots[i].label.trimmingCharacters(in:.whitespacesAndNewlines); try need(validID(slots[i].id) && !slots[i].label.isEmpty && slots[i].label.count <= 20 && minute(slots[i].start) >= 0 && minute(slots[i].start) < minute(slots[i].end) && (i == 0 || minute(slots[i-1].end) <= minute(slots[i].start)),"时间段不能重叠，结束要晚于开始") }
   try need(Set(slots.map(\.id)).count == slots.count,"时间段不能重复"); s.slots = slots
  default: throw TimetableFailure(message:"不支持这个操作")
  }
  try need(s.courses.count <= 10000,"课程数量太多啦"); s.revision += 1
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  try JSONEncoder().encode(s).write(to:file,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication]); return s
 }
 private func need(_ condition:Bool,_ text:String) throws { if !condition { throw TimetableFailure(message:text) } }
 private func validID(_ s:String) -> Bool { !s.isEmpty && s.count <= 100 }
 private func minute(_ s:String) -> Int { guard s.range(of:"^([01]\\d|2[0-3]):[0-5]\\d$",options:.regularExpression) != nil else { return -1 }; return Int(s.prefix(2))! * 60 + Int(s.suffix(2))! }
 private func validDate(_ s:String) -> Bool { guard Int(s.prefix(4)).map({$0 >= 1000}) == true,s.range(of:"^\\d{4}-\\d{2}-\\d{2}$",options:.regularExpression) != nil else { return false }; let f = DateFormatter(); f.locale = Locale(identifier:"en_US_POSIX"); f.timeZone = TimeZone(secondsFromGMT:0); f.dateFormat = "yyyy-MM-dd"; f.isLenient = false; return f.date(from:s).map { f.string(from:$0) == s } ?? false }
}
