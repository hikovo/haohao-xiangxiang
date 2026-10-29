import SwiftUI
struct RabbitPose: View {
  var mood: String
  var frame: Int? = nil
  var body: some View {
    Image(RabbitLiveAnimation.asset(mood:mood,frame:frame)).resizable().scaledToFit()
  }
}

// One bounded native geometry animation per reaction; no frame-update stream,
// content identity override, insertion transition, clipped strip or view timer.
struct RabbitLiveReaction: View {
  var mood:String
  var frame:Int?
  var actionToken:String
  @Environment(\.isLuminanceReduced) private var reducedLuminance
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  private var active:Bool {frame != nil}
  private var phase:Int {active ? (["hop":1,"wink":2,"dizzy":3][mood] ?? 0) : 0}
  var body:some View {
    let disabled=reducedLuminance || reduceMotion
    RabbitPose(mood:mood,frame:active ? 2 : nil)
      .offset(y:disabled ? 0 : active && mood == "hop" ? -10 : 0)
      .rotationEffect(.degrees(disabled ? 0 : active && mood == "dizzy" ? 12 : active && mood == "wink" ? -7 : 0))
      .scaleEffect(disabled ? 1 : active && mood == "wink" ? 1.035 : 1)
      .animation(disabled ? nil : .spring(duration:0.48,bounce:0.34),value:phase)
  }
}
