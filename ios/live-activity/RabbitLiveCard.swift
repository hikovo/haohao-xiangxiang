import SwiftUI
import AppIntents

func rabbitLiveColor(_ hex: String) -> Color {
  let value = UInt32(hex.dropFirst(), radix: 16) ?? 0xfff1f6
  return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
}
private func rabbitLiveInk(_ hex: String) -> Color {
  let value = UInt32(hex.dropFirst(), radix: 16) ?? 0xffffff
  let light = (0.2126 * Double((value >> 16) & 255) + 0.7152 * Double((value >> 8) & 255) + 0.0722 * Double(value & 255)) / 255
  return light < 0.5 ? .white : Color(red: 103/255, green: 77/255, blue: 82/255)
}

/// The bottom-left corner itself is tighter; no separate tail is attached.
private struct RabbitLiveBubble: Shape {
  func path(in rect: CGRect) -> Path {
    let r = min(CGFloat(14), rect.height / 2), left: CGFloat = 2
    var p = Path()
    p.move(to: CGPoint(x: rect.minX + r, y: rect.minY))
    p.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
    p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + r), control: CGPoint(x: rect.maxX, y: rect.minY))
    p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - r))
    p.addQuadCurve(to: CGPoint(x: rect.maxX - r, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
    p.addLine(to: CGPoint(x: rect.minX + left, y: rect.maxY))
    p.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - left), control: CGPoint(x: rect.minX, y: rect.maxY))
    p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
    p.addQuadCurve(to: CGPoint(x: rect.minX + r, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
    p.closeSubpath()
    return p
  }
}

@available(iOS 17.0, *)
struct RabbitLiveCard: View {
  var mood: String
  var message: String
  var actionToken: String = "initial"
  var poseFrame: Int? = nil
  var island = false
  var style = RabbitLiveStyle()
  var presentation:RabbitLivePresentation? = nil
  var focusSession:RabbitFocusSession? = nil
  private var bubbleHex: String { island ? style.normalized().islandBubble : style.normalized().bubble }
  private var buttonsHex: String { island ? style.normalized().islandButtons : style.normalized().buttons }
  private var cream: Color { rabbitLiveColor(bubbleHex) }
  private var pink: Color { rabbitLiveColor(buttonsHex) }
  var body: some View {
    HStack(alignment: .center, spacing: 10) {
      RabbitLiveReaction(mood:mood,frame:poseFrame,actionToken:actionToken)
        .frame(width: island ? 78 : 84, height: island ? 100 : 108)
        .accessibilityLabel("互动兔兔")
      VStack(spacing: 8) {
        RabbitFocusBubble.text(presentation ?? .init(kind:.daily,mood:mood,message:message,deadline:nil,actionToken:nil),session:focusSession).font(.system(size: 13)).lineLimit(3).minimumScaleFactor(0.9)
          .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
          .padding(.horizontal, 10).padding(.vertical, 8)
          .frame(maxWidth: .infinity, minHeight: 44)
          .foregroundStyle(rabbitLiveInk(bubbleHex))
          .background(cream.opacity(0.78), in: RabbitLiveBubble())
          .overlay(RabbitLiveBubble().stroke(Color(red: 239/255, green: 219/255, blue: 186/255).opacity(0.85), lineWidth: 0.6))
        HStack(spacing: 6) {
          action("hop", title: "跳跳")
          action("wink", title: "wink")
          action("dizzy", title: "晕晕")
          action("meal", title: "吃什么")
        }
      }.frame(maxWidth: .infinity)
    }.padding(.horizontal, 12).padding(.vertical, 10)
      .background { if island { Color.black } }
      .environment(\.colorScheme, .light)
  }
  private func action(_ value: String, title: String) -> some View {
    Button(intent: RabbitLiveActionIntent(value)) {
      Text(title).font(.system(size: 11, weight: .medium)).lineLimit(1).minimumScaleFactor(0.9)
        .frame(maxWidth: .infinity, minHeight: 34)
        .foregroundStyle(rabbitLiveInk(buttonsHex))
        .background(pink.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.35), lineWidth: 0.6))
    }.buttonStyle(.plain)
  }
}
