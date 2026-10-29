# 运行与目录

## 网页界面

需要 Node.js 和 npm。在 `ios/app` 运行：

```sh
npm ci
npm run build
npm run dev -- --host 127.0.0.1
```

打开开发服务给出的地址，并添加 `?mobile=1` 查看移动布局。界面需要图片、字体和档案数据时，请使用自行获得授权的素材填充 `ios/app/public`。空档案目录作为数据结构示例保留。

## 原生 iOS

`ios/app/src-tauri` 为 Tauri 宿主，`ios/app/plugins/mobile-pet` 为 Rust/Swift 插件。`ios/companions`、`ios/live-activity`、`ios/widgets` 分别包含共享状态与系统扩展代码。`ios/local-model/LocalLanguageModel.mm` 为 llama.cpp 推理桥接源码，模型权重、第三方推理静态库与训练材料需自行合法配置。

使用 macOS、Xcode、Rust 和 Tauri iOS 工具链生成本机 Xcode 工程，并设置自己的 Bundle ID、开发团队、App Group、WeatherKit 权限和模型资源清单。生成工程、签名证书、描述文件及 Apple 账号配置由使用者管理。

`ios/app/vendor/tao` 保留使用的上游源码、许可与场景兼容修改说明。源码许可仅覆盖作者原创部分，依赖遵循原许可。

## 与发行版本的关系

本仓库源码用于学习和非营利交流。App Store 构建 6 使用独立保留的发行包；本源码快照包含后续迭代部分，构建结果和系统界面表现需单独验证。公开整理移除了原始媒体、档案内容、个人联系账号和本机路径。
