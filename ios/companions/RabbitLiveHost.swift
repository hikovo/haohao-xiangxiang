import ActivityKit
import UIKit

/// One serial reconciliation path prevents duplicate activities and start/stop races.
@available(iOS 17.0, *)
@MainActor final class RabbitLiveHost {
  static let shared = RabbitLiveHost()
  private var configured = false
  private var desired = false
  private var state = RabbitSharedState()
  private var running = false
  private var revision = 0
  private var attempted = false
  private var lastContent: RabbitActivityAttributes.ContentState?
  private var observer: NSObjectProtocol?
  private var boundaryTask:Task<Void,Never>?
  private var boundaryKey=""
  private init() {
    #if DEBUG
    if ProcessInfo.processInfo.environment["SANHAO_LIVE_ACTION_CHECK"] == "1" { Task { await self.checkActions() } }
    #endif
    observer = NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { _ in
      Task { @MainActor in if self.configured { self.attempted = false; self.schedule() } }
    }
  }
  var status: String { Activity<RabbitActivityAttributes>.activities.isEmpty ? "inactive" : "active" }
  func apply(enabled:Bool,state:RabbitSharedState) {
    configured = true
    if desired != enabled { attempted = false }
    desired = enabled; self.state = state; revision += 1; schedule()
  }
  private func schedule() {
    guard !running else { return }; running = true
    Task { await self.reconcile(); self.running = false }
  }
  private func reconcile() async {
    repeat {
      let token = revision
      var activities = Activity<RabbitActivityAttributes>.activities
      // Existing activities can outlive an over-install and retain an older
      // extension presentation. Replace only that legacy presentation once.
      if desired && UIApplication.shared.applicationState == .active && activities.contains(where: { $0.attributes.presentationRevision != RabbitActivityAttributes.currentPresentationRevision }) {
        for activity in activities { await activity.end(nil,dismissalPolicy:.immediate) }
        activities = []; attempted = false; lastContent = nil
      }
      if !desired {
        boundaryTask?.cancel();boundaryTask=nil;boundaryKey=""
        for activity in activities { await activity.end(nil,dismissalPolicy:.immediate) }
        lastContent = nil
      } else {
        if let latest=try? RabbitStore.read() {state=latest}
        scheduleBoundary(state)
        let content = RabbitLiveContent.make(state)
        if activities.isEmpty {
          // iOS starts activities only while the host is active. A user dismissal
          // is respected until the next app visit or explicit off/on action.
          if !attempted && UIApplication.shared.applicationState == .active && ActivityAuthorizationInfo().areActivitiesEnabled {
            attempted = true
            do { _ = try Activity.request(attributes:RabbitActivityAttributes(name:"三好兔",presentationRevision:RabbitActivityAttributes.currentPresentationRevision),content:ActivityContent(state:content,staleDate:state.focusLane.staleDate(at:.now)),pushType:nil); lastContent = content; UserDefaults.standard.removeObject(forKey:"rabbit.live.error.v1") }
            catch {
              let failure=error as NSError
              UserDefaults.standard.set(["domain":failure.domain,"code":failure.code],forKey:"rabbit.live.error.v1")
              UserDefaults.standard.set("暂时没有出现在灵动岛，重新打开 App 试试吧",forKey:"rabbit.live.status.v1")
            }
          }
        } else {
          if content != lastContent {
            await RabbitLivePublisher.shared.publish(activities[0]);lastContent=content
          }
          for extra in activities.dropFirst() { await extra.end(nil,dismissalPolicy:.immediate) }
        }
      }
      if token == revision { break }
    } while true
  }
  private func scheduleBoundary(_ current:RabbitSharedState) {
    let lane=current.focusLane
    let focus=lane.activeSession(at:.now)
    let reaction=lane.reaction.flatMap {$0.endsAt > .now ? $0 : nil}
    let date=[focus?.deadline,reaction?.endsAt].compactMap {$0}.min()
    let key="\(lane.version)|\(reaction?.token ?? "")|\(date?.timeIntervalSince1970 ?? 0)"
    guard key != boundaryKey else {return}
    boundaryKey=key;boundaryTask?.cancel();boundaryTask=nil
    guard let date else {return}
    boundaryTask=Task {
      do {try await Task.sleep(for:.seconds(max(0,date.timeIntervalSinceNow)))} catch {return}
      let changed=(try? RabbitStore.transaction { state -> Bool in
        guard state.focusLane.version == lane.version else {return false}
        if let focus,focus.deadline <= .now {
          return state.focusLane.expire(expectedVersion:lane.version,sessionID:focus.id,at:.now)
        }
        if let reaction,reaction.endsAt <= .now {return state.focusLane.finishReaction(token:reaction.token)}
        return false
      }) ?? false
      if changed,let latest=try? RabbitStore.read() {self.apply(enabled:self.desired,state:latest)}
    }
  }
  #if DEBUG
  private func checkActions() async {
    UserDefaults.standard.removeObject(forKey:"rabbit.live.test-frames")
    for _ in 0..<150 {
      if !Activity<RabbitActivityAttributes>.activities.isEmpty && UIApplication.shared.applicationState == .active { break }
      try? await Task.sleep(for:.milliseconds(100))
    }
    var report:[String:Any] = ["active":Activity<RabbitActivityAttributes>.activities.count,"applicationState":UIApplication.shared.applicationState.rawValue]
    if !Activity<RabbitActivityAttributes>.activities.isEmpty {
      for action in ["hop","hop","wink","dizzy"] { _ = try? await RabbitLiveActionIntent(action).perform() }
      for _ in 0..<20 {
        if Activity<RabbitActivityAttributes>.activities.first?.content.state.poseFrame == nil { break }
        try? await Task.sleep(for:.milliseconds(50))
      }
      report["frames"] = UserDefaults.standard.array(forKey:"rabbit.live.test-frames") ?? []
      report["finishedAtRest"] = Activity<RabbitActivityAttributes>.activities.first?.content.state.poseFrame == nil
    }
    report["error"] = UserDefaults.standard.dictionary(forKey:"rabbit.live.error.v1")
    if let data = try? JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]),let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
      try? data.write(to:folder.appendingPathComponent("live-actions-check.json"),options:.atomic)
    }
  }
  #endif

}
