import Foundation

// Isolated candidate. No ActivityKit, file writes, global pet mutation or timers.
// Compile this same value model into host + extension when integrating.
struct RabbitFocusSession: Codable, Hashable {
  enum Phase: String, Codable { case running, paused, stopped }
  var id: String
  var phase: Phase
  var startedAt: Date
  var deadline: Date
  var remainingMilliseconds: Int
  var caption: String

  func isRunning(at now: Date) -> Bool { phase == .running && deadline > now }
}

struct RabbitFocusCommand: Codable, Hashable {
  // Increment only on start/pause/resume/cancel, persist in host storage.
  // A periodic sync of the same timer reuses its version.
  var version: UInt64
  var session: RabbitFocusSession?
}

struct RabbitReaction: Codable, Hashable {
  var token: String
  var action: String
  var message: String
  var startedAt: Date
  var endsAt: Date
  var focusVersion: UInt64
  var focusSessionID: String?
}

struct RabbitLivePresentation: Equatable {
  enum Kind: String { case daily, focus, reaction }
  var kind: Kind
  var mood: String
  var message: String
  var deadline: Date?
  var actionToken: String?
}

struct RabbitFocusLane: Codable, Hashable {
  private(set) var version: UInt64 = 0
  private(set) var session: RabbitFocusSession?
  private(set) var reaction: RabbitReaction?

  // The daily pet stays owned by RabbitPetState. These values are copied when
  // producing content, never overwritten by focus cleanup or store.read().
  var dailyMood = "idle"
  var dailyMessage = "今天也陪在你身边"

  @discardableResult mutating func apply(_ command: RabbitFocusCommand) -> Bool {
    guard command.version > version else { return false }
    version = command.version
    session = command.session
    reaction = nil // An explicit focus control supersedes an older callback.
    return true
  }

  @discardableResult mutating func expire(expectedVersion:UInt64,sessionID:String,at now:Date) -> Bool {
    guard version == expectedVersion, let current=session, current.id == sessionID,
      current.phase == .running, current.deadline <= now else { return false }
    return apply(.init(version:version+1,session:nil))
  }

  func activeSession(at now: Date) -> RabbitFocusSession? {
    guard let session, session.isRunning(at: now) else { return nil }
    return session
  }

  mutating func beginReaction(action: String, message: String, token: String,
                              at now: Date, duration: TimeInterval = 1.5) {
    reaction = RabbitReaction(token: token, action: action, message: message,
      startedAt: now, endsAt: now.addingTimeInterval(duration),
      focusVersion: version, focusSessionID: activeSession(at: now)?.id)
  }

  // Call after the finite native action boundary. Caller must read the latest
  // locked store again before this, never republish the captured start state.
  // Returning false means a newer tap or focus control already superseded it.
  @discardableResult mutating func finishReaction(token: String) -> Bool {
    guard reaction?.token == token, reaction?.focusVersion == version else { return false }
    reaction = nil
    return true
  }

  func presentation(at now: Date, isStale: Bool = false) -> RabbitLivePresentation {
    // isStale is reserved for the focus deadline, not the reaction timeout.
    // It gives the extension a system-driven branch when the host is suspended.
    let focus = isStale ? nil : activeSession(at: now)
    if let reaction, reaction.focusVersion == version, reaction.endsAt > now {
      // An action that started in focus may not survive cancellation, pause or
      // expiry as a stale work state. A later daily action remains valid.
      let originStillValid = reaction.focusSessionID == nil || reaction.focusSessionID == focus?.id
      if originStillValid {
        return .init(kind:.reaction, mood:reaction.action, message:reaction.message,
          deadline:nil, actionToken:reaction.token)
      }
    }
    if let focus {
      return .init(kind:.focus, mood:"typing", message:focus.caption,
        deadline:focus.deadline, actionToken:nil)
    }
    return .init(kind:.daily, mood:dailyMood, message:dailyMessage,
      deadline:nil, actionToken:nil)
  }

  // Every action content and its settling update must retain this same focus
  // stale date. Do not consume the sole staleDate for a short reaction timeout.
  func staleDate(at now: Date) -> Date? { activeSession(at: now)?.deadline }
}

enum RabbitFocusCaptions {
  static let all = [
    "这一小段，兔兔陪你认真呀", "敲敲键盘，慢慢往前走",
    "把眼前的小事一点点做好", "兔兔守在这里，陪你再努力一会儿",
    "先做这一件，做完就歇歇", "时间慢慢走，我们也稳稳来"
  ]
  static func choose(excluding previous: String?, randomIndex: (Int) -> Int) -> String {
    let candidates = all.filter { $0 != previous }
    return candidates[randomIndex(candidates.count) % candidates.count]
  }
}
