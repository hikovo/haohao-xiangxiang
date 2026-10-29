import SwiftUI

// Isolated presentation adapter, inserted where the existing bubble Text is.
// Keep the existing bubble's padding/font/frame/background and button layout.
@available(iOS 17.0, *)
struct RabbitFocusBubble {
  static func text(_ presentation: RabbitLivePresentation, session: RabbitFocusSession?) -> Text {
    guard presentation.kind == .focus, let deadline=presentation.deadline, let session else {
      return Text(presentation.message)
    }
    // The system owns ticking. No per-second bridge or ActivityKit update.
    // Caller computes presentation with context.isStale, so the stale branch
    // returns the daily Text instead of constructing a zero-countdown timer.
    return Text(presentation.message + " · ") + Text(
      timerInterval: session.startedAt...deadline,
      countsDown: true, showsHours: false
    ).monospacedDigit()
  }
}
