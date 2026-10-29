import Foundation
import ActivityKit
import UIKit
import Darwin


// Narrow C boundary: the Rust-linked Swift plugin need not own widget types.
private func bridgeJSON(_ value: [String: Any]) -> UnsafeMutablePointer<CChar>? {
  let data = (try? JSONSerialization.data(withJSONObject: value)) ?? Data("{}".utf8)
  return strdup(String(decoding: data, as: UTF8.self))
}
@_cdecl("sanhao_rabbit_sync")
public func sanhaoRabbitSync(_ payload: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>? {
  do {
    let request = try JSONDecoder().decode(RabbitSyncRequest.self, from: Data(String(cString: payload).utf8))
    let state = try RabbitStore.transaction { state in
      if let meals = request.meals { RabbitStore.setMeals(meals, state: &state) }
      if let style=request.liveStyle {state.liveStyle=style.normalized()}
      request.focus?.apply(to:&state)
      state.snapshot = request.snapshot
      if let action = request.petAction {
        if action == "meal" { RabbitStore.pickMeal(state: &state) } else { RabbitStore.act(action, state: &state, message: request.petMessage) }
        let token=UUID().uuidString
        state.pet.liveActionToken=token;state.pet.liveActionStartedAt = .now
        state.focusLane.beginReaction(action:action,message:state.pet.message,token:token,at:.now)
      }
      state.pending.removeAll { request.acknowledged.contains($0.id) }
      RabbitStore.applying(state.pending, to: &state.snapshot)
      return state
    }
    if #available(iOS 17, *), let enabled = request.followEnabled {
      Task { @MainActor in RabbitLiveHost.shared.apply(enabled:enabled,state:state) }
    }
    if #available(iOS 17, *), let weather = request.weather {
      Task { @MainActor in RabbitWeather.shared.apply(weather, force: request.weatherRefresh == true) }
    }
    var result: [String: Any] = ["shared": RabbitStore.sharedAvailable, "pending": try JSONSerialization.jsonObject(with: JSONEncoder().encode(state.pending)), "pet": try JSONSerialization.jsonObject(with: JSONEncoder().encode(state.pet))]
    result["weather"] = UserDefaults.standard.dictionary(forKey: "rabbit.weather.status.v1") ?? ["message": "开启后使用系统定位获取当地天气"]
    if UserDefaults.standard.bool(forKey:"rabbit.pending-weather-open.v1") {
      result["openWeather"] = true; UserDefaults.standard.removeObject(forKey:"rabbit.pending-weather-open.v1")
    }
    if let meal = UserDefaults.standard.string(forKey:"rabbit.pending-meal-open.v1") {
      result["openMeal"] = meal; UserDefaults.standard.removeObject(forKey:"rabbit.pending-meal-open.v1")
    }
    result["meal"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(state.meal))
    result["focusRevision"] = state.focusInputRevision
    if let route = UserDefaults.standard.dictionary(forKey: "rabbit.pending-route.v1") {
      result["route"] = route; UserDefaults.standard.removeObject(forKey: "rabbit.pending-route.v1")
    }
    return bridgeJSON(result)
  } catch { return bridgeJSON(["error": error.localizedDescription]) }
}

@_cdecl("sanhao_rabbit_live")
public func sanhaoRabbitLive(_ operation:UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>? {
  guard #available(iOS 17, *) else { return bridgeJSON(["status":"unsupported"]) }
  return bridgeJSON(["status":Activity<RabbitActivityAttributes>.activities.isEmpty ? "inactive":"active","count":Activity<RabbitActivityAttributes>.activities.count,"allowed":ActivityAuthorizationInfo().areActivitiesEnabled,"applicationState":UIApplication.shared.applicationState.rawValue,"error":UserDefaults.standard.dictionary(forKey:"rabbit.live.error.v1") ?? [:]])
}
