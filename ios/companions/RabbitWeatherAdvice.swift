import Foundation
// Weather bulletins use real forecasts, followed by condition-based care.
enum RabbitWeatherAdvice {
  static func reminders(low: Double, high: Double, previousHigh: Double?, rainChance: Double,
                        uv: Int = 0, wind: Double = 0, rules: [String] = ["cold", "heat", "rain", "sunWind"]) -> [String] {
    var advice: [String] = []
    if rules.contains("cold") {
      if let previous = previousHigh, previous - high >= 3 { advice.append("aiya，降温啦，出门记得添件衣服呀") }
      else if low <= 8 { advice.append("外面有点冷，穿暖一点再出门喔") }
      else if low <= 15 { advice.append("早晚凉凉的，带件外套陪着你吧") }
    }
    if rules.contains("heat"), high >= 30 { advice.append("天热啦，记得喝水，找阴凉处歇一歇呀") }
    if rules.contains("rain"), rainChance >= 0.5 { advice.append("可能要下雨，出门把小伞带上呀") }
    if rules.contains("sunWind") {
      if uv >= 6 { advice.append("阳光有点厉害，帽子和防晒要记得喔") }
      if wind >= 10 { advice.append("外面风有点大，出门注意防风呀") }
    }
    return advice
  }
  static func conditionName(_ value: String) -> String {
    let names = ["clear":"晴", "mostlyclear":"晴间少云", "partlycloudy":"晴间多云", "mostlycloudy":"多云", "cloudy":"阴", "drizzle":"毛毛雨", "rain":"有雨", "heavyrain":"大雨", "sunshowers":"阵雨", "thunderstorms":"雷雨", "isolatedthunderstorms":"局部雷雨", "scatteredthunderstorms":"零星雷雨", "strongstorms":"强雷雨", "snow":"下雪", "heavysnow":"大雪", "flurries":"零星小雪", "sleet":"雨夹雪", "freezingrain":"冻雨", "freezingdrizzle":"冻毛毛雨", "foggy":"有雾", "haze":"有霾", "smoky":"有烟霾", "windy":"有风", "breezy":"微风", "blizzard":"暴风雪", "blowingsnow":"风吹雪", "blowingdust":"扬尘", "hail":"冰雹", "hot":"炎热", "frigid":"寒冷", "hurricane":"飓风", "tropicalstorm":"热带风暴", "wintrymix":"雨雪混合"]
    return names[value.filter { $0.isLetter }.lowercased()] ?? ""
  }
  static func bulletin(low: Double, high: Double, condition: String, hour: Int, temperature: Double? = nil, rainChance: Double, wind: Double, uv: Int, advice: [String]) -> String {
    let greeting = hour < 11 ? "早呀" : hour < 17 ? "下午好呀" : "晚上好呀"
    let sky = conditionName(condition)
    var text = greeting + "，" + (sky.isEmpty ? "今天气温" : "今天" + sky + "，气温") + "\(Int(low.rounded()))到\(Int(high.rounded()))度。"
    if let temperature { text += "这会儿大约\(Int(temperature.rounded()))度。" }
    text += "风速约\(Int(wind.rounded()))米每秒。"
    if uv >= 3 { text += "紫外线指数\(uv)。" }
    text += advice.isEmpty ? "出门慢慢来，今天也照顾好自己呀。" : advice.joined(separator:"；") + "。"
    return text
  }
  static func text(low: Double, high: Double, previousHigh: Double?, rainChance: Double) -> String {
    let advice = reminders(low: low, high: high, previousHigh: previousHigh, rainChance: rainChance)
    return advice.isEmpty ? "带着好心情出门，兔兔陪着你" : advice.joined(separator: "；")
  }
}
