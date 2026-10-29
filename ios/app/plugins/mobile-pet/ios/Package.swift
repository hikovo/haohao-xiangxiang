// swift-tools-version:5.5
import PackageDescription
let package = Package(
  name: "tauri-plugin-mobile-pet",
  platforms: [.iOS(.v15)],
  products: [.library(name: "tauri-plugin-mobile-pet", type: .static, targets: ["MobilePetPlugin"])],
  dependencies: [.package(name: "Tauri", path: "../.tauri/tauri-api")],
  targets: [.target(name: "MobilePetPlugin", dependencies: [.byName(name: "Tauri")], path: "Sources")]
)
