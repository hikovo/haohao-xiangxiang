import Foundation
import ActivityKit
import AppIntents

@available(iOS 17.0, *)
struct RabbitActivityAttributes: ActivityAttributes {
  static let currentPresentationRevision = "20261025-native-motion-1"
  struct ContentState: Codable, Hashable {
    var mood: String
    var message: String
    var affection: Int
    var carrots: Int
    var actionToken: String? = nil
    var poseFrame: Int? = nil
    var animationStartedAt: Date? = nil
    var isAnimating: Bool { animationStartedAt.map { Date.now.timeIntervalSince($0) < 2 } ?? false }
    var liveStyle: RabbitLiveStyle? = nil
    var focusLane: RabbitFocusLane? = nil
    var animationKey: String { actionToken ?? "\(mood)|\(message)|\(affection)|\(carrots)" }
  }
  var name: String
  var presentationRevision: String? = nil
}
@available(iOS 17.0, *)
struct RabbitLiveActionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "和兔兔玩一会儿"
  @Parameter(title:"互动") var action: String
  init() { action = "hop" }
  init(_ action:String) { self.action = action }
  func perform() async throws -> some IntentResult {
    guard ["hop","wink","dizzy","meal"].contains(action) else { return .result() }
    let token = UUID().uuidString, started = Date.now
    let state = try RabbitStore.transaction { state in
      if action == "meal" { RabbitStore.pickMeal(state:&state) }
      else { RabbitStore.act(action,state:&state) }
      state.pet.liveActionToken = token; state.pet.liveActionStartedAt = started
      state.focusLane.beginReaction(action:action,message:state.pet.message,token:token,at:started)
      return state
    }
    let version = state.focusLane.version
    for activity in Activity<RabbitActivityAttributes>.activities {
      await RabbitLivePublisher.shared.publish(activity,expectedVersion:version,expectedToken:token)
    }
    try? await Task.sleep(for:.milliseconds(1500))
    let settled = try RabbitStore.transaction { current -> Bool in
      current.focusLane.finishReaction(token:token)
    }
    if settled {
      for activity in Activity<RabbitActivityAttributes>.activities {
        await RabbitLivePublisher.shared.publish(activity,expectedVersion:version,expectedToken:nil)
      }
    }
    return .result()
  }
}

enum RabbitLiveAnimation {
  static let frameMilliseconds = 180
  static func frames(for action:String) -> [Int] { Array(0..<(["hop":4,"wink":5,"dizzy":8][action] ?? 0)) }
  static func asset(mood:String,frame:Int?) -> String {
    if let frame, frames(for:mood).contains(frame) { return "Rabbit"+mood.capitalized+"Frame"+String(frame) }
    return ["idle":"RabbitIdle","happy":"RabbitHappy","focus":"RabbitFocus","typing":"RabbitFocus"][mood] ?? "RabbitIdle"
  }
  #if DEBUG
  static func trace(action:String,frame:Int,token:String,actual:Int?) {
    guard ProcessInfo.processInfo.environment["SANHAO_LIVE_ACTION_CHECK"] == "1" else { return }
    var rows = UserDefaults.standard.array(forKey:"rabbit.live.test-frames") as? [[String:Any]] ?? []
    rows.append(["action":action,"frame":frame,"actual":actual ?? -1,"token":token,"at":Date.now.timeIntervalSince1970])
    UserDefaults.standard.set(rows,forKey:"rabbit.live.test-frames")
    if let data = try? JSONSerialization.data(withJSONObject:rows,options:[.prettyPrinted,.sortedKeys]),let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
      try? data.write(to:folder.appendingPathComponent("live-frame-trace.json"),options:.atomic)
    }
  }
  #endif
}

// One serial publication queue shared by the host reconciler and interactive
// intents. Read the latest locked value at execution time, not a captured focus.
@available(iOS 17.0, *)
actor RabbitLivePublisher {
  static let shared=RabbitLivePublisher()
  private var tail:Task<Void,Never>?
  func publish(_ activity:Activity<RabbitActivityAttributes>,expectedVersion:UInt64?=nil,expectedToken:String?=nil) async {
    let previous=tail
    let task=Task {
      await previous?.value
      guard let state=try? RabbitStore.read() else {return}
      if let expectedVersion,state.focusLane.version != expectedVersion {return}
      guard state.focusLane.reaction?.token == expectedToken || expectedVersion == nil else {return}
      let content=RabbitLiveContent.make(state)
      await activity.update(ActivityContent(state:content,staleDate:state.focusLane.staleDate(at:.now)))
    }
    tail=task;await task.value
  }
}
@available(iOS 17.0, *)
enum RabbitLiveContent {
  static func make(_ state:RabbitSharedState)->RabbitActivityAttributes.ContentState {
    let display=state.focusLane.presentation(at:.now)
    return .init(mood:display.mood,message:display.message,affection:state.pet.affection,carrots:state.pet.carrots,
      actionToken:display.actionToken,poseFrame:display.kind == .reaction ? 2 : nil,
      liveStyle:state.liveStyle,focusLane:state.focusLane)
  }
}
