# Tao 0.35.3 本地 iOS 修复

来源：本机 Cargo 下载的 `tao 0.35.3` 原始发布包。保留 `tao/LICENSE`、`tao/LICENSE.spdx` 与源文件版权声明；通过 `src-tauri/Cargo.toml` 的 `[patch.crates-io]` 引用，不修改全局 Cargo 缓存或 Android 基线。

只修改 `src/platform_impl/ios/{scene,view,app_state}.rs`：

- 以 `UIApplicationSceneManifest` 的存在判断是否使用场景生命周期。单窗口（`UIApplicationSupportsMultipleScenes=false`）也必须注册场景代理、延后 App 就绪到场景连接、给窗口分配场景。是否允许额外窗口仍使用 UIKit 的 `supportsMultipleScenes()`。
- `UISceneConfiguration` 返回指针改用 `Retained::autorelease_ptr`，避免局部对象释放后把悬空指针交给 UIKit。

依据：[Tao #1308](https://github.com/tauri-apps/tao/issues/1308)、[Tao #1245](https://github.com/tauri-apps/tao/pull/1245)、[Apple 场景迁移说明](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)。当前 Tauri 的依赖要求 Tao 0.35，因此没有直接替换为 API 不兼容的 0.37。

本地验证：Xcode 27 / iOS 27 / iPhone 17 模拟器，debug 构建、安装与首屏运行通过。iOS 15 真机、release、后台恢复和 iPad 尚未验收。未来升级 Tauri 后应核对上游修复并移除这份本地补丁。
