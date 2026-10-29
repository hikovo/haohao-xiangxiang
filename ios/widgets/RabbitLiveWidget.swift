import SwiftUI
import WidgetKit
import ActivityKit

struct RabbitLiveWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RabbitActivityAttributes.self) { context in
      RabbitLiveCard(mood: context.state.mood, message: context.state.message, actionToken: context.state.animationKey, poseFrame: context.state.poseFrame, style: context.state.liveStyle ?? .init())
        .activityBackgroundTint(rabbitLiveColor((context.state.liveStyle ?? .init()).normalized().background).opacity(0.7))
        .activitySystemActionForegroundColor(Color(red: 0.72, green: 0.44, blue: 0.51))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.bottom) {
          RabbitLiveCard(mood: context.state.mood, message: context.state.message, actionToken: context.state.animationKey, poseFrame: context.state.poseFrame, island: true, style: context.state.liveStyle ?? .init())
        }
      } compactLeading: {
        RabbitPose(mood: context.state.mood, frame: context.state.poseFrame).frame(width: 24, height: 27)
      } compactTrailing: {
        Text("兔兔").font(.system(size: 11)).foregroundStyle(Color(red: 1, green: 0.84, blue: 0.88))
      } minimal: {
        RabbitPose(mood: context.state.mood, frame: context.state.poseFrame).frame(width: 22, height: 25)
      }
      .keylineTint(.black)
    }
  }
}
