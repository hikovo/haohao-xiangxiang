import SwiftUI
import WidgetKit
import ActivityKit

struct RabbitLiveWidget: Widget {
  private func display(_ state:RabbitActivityAttributes.ContentState,_ stale:Bool)->RabbitLivePresentation {
    state.focusLane?.presentation(at:.now,isStale:stale) ?? .init(kind:.daily,mood:state.mood,message:state.message,deadline:nil,actionToken:state.actionToken)
  }
  private func card(_ context:ActivityViewContext<RabbitActivityAttributes>,island:Bool=false)->some View {
    let p=display(context.state,context.isStale)
    return RabbitLiveCard(mood:p.mood,message:p.message,actionToken:p.actionToken ?? "rest",poseFrame:p.kind == .reaction ? 2 : nil,
      island:island,style:context.state.liveStyle ?? .init(),presentation:p,focusSession:context.state.focusLane?.session)
  }
  var body:some WidgetConfiguration {
    ActivityConfiguration(for:RabbitActivityAttributes.self) {context in
      card(context)
        .activityBackgroundTint(rabbitLiveColor((context.state.liveStyle ?? .init()).normalized().background).opacity(0.7))
        .activitySystemActionForegroundColor(Color(red:0.72,green:0.44,blue:0.51))
    } dynamicIsland:{context in
      let p=display(context.state,context.isStale)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.bottom) {card(context,island:true)}
      } compactLeading:{
        RabbitLiveReaction(mood:p.mood,frame:p.kind == .reaction ? 2 : nil,actionToken:p.actionToken ?? "rest").frame(width:24,height:27)
      } compactTrailing:{
        if p.kind == .focus,let deadline=p.deadline,let session=context.state.focusLane?.session {
          Text(timerInterval:session.startedAt...deadline,countsDown:true,showsHours:false).monospacedDigit().font(.system(size:11)).foregroundStyle(Color(red:1,green:0.84,blue:0.88))
        } else {Text("兔兔").font(.system(size:11)).foregroundStyle(Color(red:1,green:0.84,blue:0.88))}
      } minimal:{
        RabbitLiveReaction(mood:p.mood,frame:p.kind == .reaction ? 2 : nil,actionToken:p.actionToken ?? "rest").frame(width:22,height:25)
      }.keylineTint(.black)
    }
  }
}
@main struct RabbitLiveBundle:WidgetBundle {var body:some Widget {RabbitLiveWidget()}}
