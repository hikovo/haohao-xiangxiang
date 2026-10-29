#!/usr/bin/env python3
"""Apply local Xcode configuration after Tauri generates the iOS project."""
from pathlib import Path
import json
import os
import plistlib
import re
import shutil
import subprocess

app = Path(__file__).resolve().parent / "app"
apple = app / "src-tauri/gen/apple"
version = json.loads((app / "src-tauri/tauri.conf.json").read_text())["version"]
build_number = os.environ.get("SANHAO_BUILD_NUMBER", version)
if not re.fullmatch(r"[1-9][0-9]{0,3}(?:\.[0-9]{1,2}){0,2}", build_number):
    raise SystemExit("Invalid Apple build number")
project = apple / "sanhao-tune.xcodeproj/project.pbxproj"
if not project.exists():
    raise SystemExit("先在 ios/app 中运行 pnpm tauri ios init，再启动开发环境。")

node = shutil.which("node") or "/opt/homebrew/bin/node"
cargo = Path.home() / ".cargo/bin"
script = (
    'if [ "${SANHAO_USE_PREBUILT_RUST:-0}" = 1 ]; then exit 0; fi; '
    f"env PATH={cargo}:/opt/homebrew/bin:$PATH {node} "
    "../../../node_modules/@tauri-apps/cli/tauri.js ios xcode-script -v "
    '--platform ${PLATFORM_DISPLAY_NAME:?} --sdk-root ${SDKROOT:?} '
    '--framework-search-paths "${FRAMEWORK_SEARCH_PATHS:?}" '
    '--header-search-paths "${HEADER_SEARCH_PATHS:?}" '
    '--gcc-preprocessor-definitions "${GCC_PREPROCESSOR_DEFINITIONS:-}" '
    '--configuration ${CONFIGURATION:?} ${FORCE_COLOR} ${ARCHS:?}'
)
# The extension exposes the live activity only, with no desktop widgets.
ui_tests = apple / "FeatureTests"
ui_tests.mkdir(exist_ok=True)
for test_source in (app.parent / "tests/ui").glob("*.swift"):
    shutil.copy2(test_source, ui_tests / test_source.name)
support = apple / "CompanionSupport"
support.mkdir(exist_ok=True)
services = ["RabbitShared.swift", "RabbitFocusLane.swift", "RabbitReplies.swift", "RabbitWeather.swift", "RabbitWeatherAdvice.swift", "RabbitHostBridge.swift", "RabbitLiveActivity.swift", "RabbitLiveHost.swift"]
for source in services:
    shutil.copy2(app.parent / "companions" / source, support / source)
spec = apple / "project.yml"
spec_text = spec.read_text()
# Native libraries are linked through dependencies, never copied as app resources.
# Otherwise Xcode copies both debug and release libapp.a to the same bundle path.
spec_text = re.sub(r'(?m)^(      - path: Externals)\n(?:        buildPhase: [^\n]+\n)?', r'\1\n        buildPhase: none\n', spec_text)
spec_text = re.sub(r'(?m)^(        CFBundle(ShortVersionString|Version):) .*',lambda m:m[1]+' "'+(version if m[2]=='ShortVersionString' else build_number)+'"',spec_text)
spec_text = re.sub(r"(?ms)^  SanhaoRabbitWidgets:.*\Z", "", spec_text)
spec_text = spec_text.replace("      - target: SanhaoRabbitWidgets\n        embed: true\n", "")
spec_text = spec_text.replace("      - target: SanhaoModelDownloader\n        embed: true\n", "")
# An explicit source list prevents historical preview/intent files from compiling.
service_spec = "\n".join("      - path: CompanionSupport/" + name for name in services)
spec_text = re.sub(r"(?m)^      - path: CompanionSupport(?:/[^\n]+)?$", "", spec_text)
spec_text = spec_text.replace("      - path: Externals", service_spec + "\n      - path: Externals")
spec_text = spec_text.replace(', "-Wl,-u,_sanhao_rabbit_live"', '')
spec_text = spec_text.replace('"-Wl,-u,_sanhao_rabbit_sync"', '"-Wl,-u,_sanhao_rabbit_sync", "-Wl,-u,_sanhao_rabbit_live"')
if "_sanhao_rabbit_sync" not in spec_text:
    spec_text = spec_text.replace("        ENABLE_BITCODE: false", '        OTHER_LDFLAGS: ["$(inherited)", "-Wl,-export_dynamic", "-Wl,-u,_sanhao_rabbit_sync"]\n        ENABLE_BITCODE: false')
live = apple / "RabbitLiveActivity"
live.mkdir(exist_ok=True)
shutil.copy2(app.parent / "PrivacyInfo.xcprivacy",apple / "PrivacyInfo.xcprivacy")
shutil.copy2(app.parent / "live-activity/PrivacyInfo.xcprivacy",live / "PrivacyInfo.xcprivacy")
if "      - path: PrivacyInfo.xcprivacy" not in spec_text:
    spec_text = spec_text.replace("      - path: Assets.xcassets", "      - path: PrivacyInfo.xcprivacy\n        buildPhase: resources\n      - path: Assets.xcassets")
for source in (app.parent / "live-activity").glob("*.swift"):
    shutil.copy2(source, live / source.name)
for name in ["RabbitShared.swift", "RabbitFocusLane.swift", "RabbitReplies.swift", "RabbitLiveActivity.swift"]:
    shutil.copy2(app.parent / "companions" / name, live / name)
shutil.copytree(app.parent / "widgets/Assets.xcassets",live / "Assets.xcassets",dirs_exist_ok=True)
spec_text = spec_text.replace("    dependencies:\n      - framework: libapp.a", "    dependencies:\n      - target: SanhaoRabbitWidgets\n        embed: true\n      - framework: libapp.a")
# Keep the language runtime entirely in the host app, outside the accepted
# activity extension and outside the web-accessible archive resources.
model_bundle = app.parent / "local-model/bundle/LocalModel"
use_model = os.environ.get("SANHAO_ENABLE_LOCAL_MODEL", "1" if (model_bundle/"LocalChat.gguf").exists() else "0") == "1"
embed_model = os.environ.get("SANHAO_EMBED_LOCAL_MODEL", "0") == "1"
use_group = use_model or os.environ.get("SANHAO_ENABLE_APP_GROUP") == "1"
use_weather = os.environ.get("SANHAO_ENABLE_WEATHERKIT") == "1"
use_hosted_model = use_model and not embed_model
if use_model and not (model_bundle/"LocalChat.gguf").exists():
    raise SystemExit("No selected local language adapter; build the interface without the retired model")
spec_text = re.sub(r"(?m)^      - path: NativeModel[^\n]*\n(?:        [^\n]*\n)*", "", spec_text)
spec_text = re.sub(r"(?m)^      - (?:library|framework): .*local-model/native-build/[^\n]*\n(?:        embed: false\n)?", "", spec_text)
spec_text = re.sub(r'"-L[^"\n]*local-model/native-build/[^"\n]*",? ?', '', spec_text)
if use_model:
    spec_text = re.sub(r'(?m)^        CLANG_CXX_LANGUAGE_STANDARD:.*\n', '', spec_text)
    sdk = os.environ.get("SANHAO_NATIVE_SDK", "iphoneos")
    if sdk not in ["iphoneos", "iphonesimulator"]: raise SystemExit("Unsupported local model SDK")
    native = apple / "NativeModel"; native.mkdir(exist_ok=True)
    shutil.copy2(app.parent/"local-model/LocalLanguageModel.mm",native/"LocalLanguageModel.mm")
    # This is generated staging, not user data. Mirror the selected bundle so a
    # model switch cannot accidentally retain the previous multi-GB weights.
    if (native/"LocalModel").exists():
        shutil.rmtree(native/"LocalModel")
    if embed_model:
        shutil.copytree(model_bundle,native/"LocalModel")
    # Only the signed hashes and metadata belong to the initial app download.
    import hashlib
    resource_files=[]
    for name in ["LocalChat.gguf","LocalChat-LoRA.gguf"]:
        path=model_bundle/name
        digest=hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda:handle.read(8*1024*1024),b""):digest.update(chunk)
        resource_files.append(dict(name=name,packID="sanhao-chat-base" if name=="LocalChat.gguf" else "sanhao-chat-style",bytes=path.stat().st_size,sha256=digest.hexdigest()))
    resource_manifest=dict(packID="sanhao-chat-base",stylePackID="sanhao-chat-style",version=resource_files[-1]["sha256"][:16],bytes=sum(f["bytes"] for f in resource_files),files=resource_files)
    (native/"ModelResourceManifest.json").write_text(json.dumps(resource_manifest,indent=2)+"\n")
    source = app.parent.parent / "android/baseline/runtime/llama.cpp-b11223"
    shutil.copy2(source/"include/llama.h",native/"llama.h")
    for header in (source/"ggml/include").glob("*.h"): shutil.copy2(header,native/header.name)
    build = app.parent/"local-model/native-build"/sdk
    libraries = [build/"src/libllama.a",build/"ggml/src/libggml.a",build/"ggml/src/libggml-base.a",build/"ggml/src/libggml-cpu.a"]
    if (build/"ggml/src/ggml-metal/libggml-metal.a").exists(): libraries.append(build/"ggml/src/ggml-metal/libggml-metal.a")
    if not all(p.exists() for p in libraries): raise SystemExit("Build the native language runtime first")
    model_resources="      - path: NativeModel/LocalModel\n        type: folder\n        buildPhase: resources\n" if embed_model else ""
    spec_text = spec_text.replace("      - path: Externals", "      - path: NativeModel\n        excludes: [LocalModel, ModelResourceManifest.json]\n      - path: NativeModel/ModelResourceManifest.json\n        buildPhase: resources\n"+model_resources+"      - path: Externals")
    dependency_lines = "".join("      - framework: "+str(p)+"\n        embed: false\n" for p in libraries)
    spec_text = spec_text.replace("      - sdk: CoreGraphics.framework",dependency_lines+"      - sdk: CoreGraphics.framework")
    search_paths = ["$(inherited)", *dict.fromkeys(str(p.parent) for p in libraries)]
    spec_text = re.sub(r'(?m)^        LIBRARY_SEARCH_PATHS:.*\n', '', spec_text)
    spec_text = spec_text.replace("        ENABLE_BITCODE: false", "        LIBRARY_SEARCH_PATHS: "+json.dumps(search_paths)+"\n        ENABLE_BITCODE: false")
    if "- sdk: Accelerate.framework" not in spec_text: spec_text = spec_text.replace("      - sdk: Metal.framework", "      - sdk: Accelerate.framework\n      - sdk: Metal.framework")
    spec_text = spec_text.replace('"-Wl,-u,_sanhao_local_chat", ', '')
    spec_text = spec_text.replace('"-Wl,-export_dynamic", ', '"-Wl,-export_dynamic", "-Wl,-u,_sanhao_local_chat", ')
    spec_text = spec_text.replace('"-Wl,-export_dynamic", ', '"-Wl,-export_dynamic", '+''.join(json.dumps('-L'+p)+', ' for p in search_paths[1:]))
    spec_text = spec_text.replace("        ENABLE_BITCODE: false", '        CLANG_CXX_LANGUAGE_STANDARD: "c++17"\n        ENABLE_BITCODE: false')
else:
    spec_text = spec_text.replace('"-Wl,-u,_sanhao_local_chat", ', '')
# Archive's symbol stripping must retain the C boundaries found through dlsym.
# -u alone retains code, but does not guarantee a dynamic export in an archive.
# Xcode's debug dylib launcher resolves _main dynamically as well.
exported_bridges = ["_main", "_sanhao_rabbit_sync", "_sanhao_rabbit_live"]
if use_model:
    exported_bridges.append("_sanhao_local_chat")
spec_text = re.sub(r'"-Wl,-exported_symbol,(?:_sanhao_[^"]+|_main)",? ?', '', spec_text)
spec_text = spec_text.replace('"-Wl,-export_dynamic", ', '"-Wl,-export_dynamic", ' + ''.join(json.dumps("-Wl,-exported_symbol," + symbol) + ', ' for symbol in exported_bridges))
spec_text = re.sub(r'(?m)^        STRIP_STYLE:.*\n', '', spec_text)
spec_text = spec_text.replace('        ENABLE_BITCODE: false', '        STRIP_STYLE: non-global\n        ENABLE_BITCODE: false')
spec_text=re.sub(r"(?m)^        BA(?:AppGroupID|HasManagedAssetPacks|UsesAppleHosting):.*\n", "",spec_text)
if use_hosted_model:
    downloader=apple/"ModelDownloader";downloader.mkdir(exist_ok=True)
    shutil.copy2(app.parent/"model-assets/DownloaderExtension.swift",downloader/"DownloaderExtension.swift")
    group="group.com.hikovo.sanhaotu.companion"
    (downloader/"ModelDownloader.entitlements").write_bytes(plistlib.dumps({"com.apple.security.application-groups":[group]}))
    spec_text=spec_text.replace("    dependencies:\n      - target: SanhaoRabbitWidgets", "    dependencies:\n      - target: SanhaoModelDownloader\n        embed: true\n      - target: SanhaoRabbitWidgets") if "      - target: SanhaoRabbitWidgets" in spec_text else spec_text.replace("    dependencies:\n", "    dependencies:\n      - target: SanhaoModelDownloader\n        embed: true\n",1)
    # Keep host policy keys in project.yml as well as the generated Info.plist.
    spec_text=re.sub(r"(?m)^        BA(?:AppGroupID|HasManagedAssetPacks|UsesAppleHosting):.*\n", "",spec_text)
    spec_text=spec_text.replace("        LSRequiresIPhoneOS: true", "        BAAppGroupID: "+group+"\n        BAHasManagedAssetPacks: true\n        BAUsesAppleHosting: true\n        LSRequiresIPhoneOS: true")
spec_text += f'''
  SanhaoRabbitWidgets:
    type: app-extension
    platform: iOS
    deploymentTarget: "17.0"
    sources: [RabbitLiveActivity]
    entitlements:
      path: RabbitLiveActivity/LiveActivity.entitlements
      properties:
        com.apple.security.application-groups: [group.com.hikovo.sanhaotu.companion]
    info:
      path: RabbitLiveActivity/Info.plist
      properties:
        CFBundleDisplayName: 灵动岛陪伴
        RabbitSharedRecordsEnabled: {str(use_group).lower()}
        CFBundleShortVersionString: "{version}"
        CFBundleVersion: "{build_number}"
        NSExtension:
          NSExtensionPointIdentifier: com.apple.widgetkit-extension
    settings:
      base:
        PRODUCT_NAME: SanhaoRabbitWidgets
        PRODUCT_BUNDLE_IDENTIFIER: com.hikovo.sanhaotu.widgets
        SWIFT_VERSION: "5.0"
        SKIP_INSTALL: true
        APPLICATION_EXTENSION_API_ONLY: true
        TARGETED_DEVICE_FAMILY: "1,2"
'''
if use_hosted_model:
    spec_text += f'''
  SanhaoModelDownloader:
    type: extensionkit-extension
    platform: iOS
    deploymentTarget: "26.0"
    sources: [ModelDownloader/DownloaderExtension.swift]
    entitlements:
      path: ModelDownloader/ModelDownloader.entitlements
      properties:
        com.apple.security.application-groups: [group.com.hikovo.sanhaotu.companion]
    info:
      path: ModelDownloader/Info.plist
      properties:
        CFBundleDisplayName: 聊天资源
        CFBundleShortVersionString: "{version}"
        CFBundleVersion: "{build_number}"
        EXAppExtensionAttributes:
          EXExtensionPointIdentifier: com.apple.background-asset-downloader-extension
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.hikovo.sanhaotu.model-download
        SWIFT_VERSION: "5.0"
        SKIP_INSTALL: true
        APPLICATION_EXTENSION_API_ONLY: true
        TARGETED_DEVICE_FAMILY: "1,2"
'''
# Keep runtime policy in the spec so a later xcodegen invocation preserves it.
spec_text = re.sub(r"(?m)^        (?:RabbitSharedRecordsEnabled|RabbitWeatherEnabled|NSSupportsLiveActivities):.*\n", "", spec_text)
spec_text = spec_text.replace("        LSRequiresIPhoneOS: true", f"        RabbitSharedRecordsEnabled: {str(use_group).lower()}\n        RabbitWeatherEnabled: {str(use_weather).lower()}\n        NSSupportsLiveActivities: true\n        LSRequiresIPhoneOS: true")
spec_text = spec_text.replace("        CFBundleDisplayName: 灵动岛陪伴\n", f"        CFBundleDisplayName: 灵动岛陪伴\n        RabbitSharedRecordsEnabled: {str(use_group).lower()}\n")
host_entitlement_anchor = "      path: sanhao-tune_iOS/sanhao-tune_iOS.entitlements"
host_properties = {"com.apple.security.application-groups": ["group.com.hikovo.sanhaotu.companion"]} if use_group else {}
if use_weather: host_properties["com.apple.developer.weatherkit"] = True
spec_text = re.sub(r"(?m)(^      path: sanhao-tune_iOS/sanhao-tune_iOS.entitlements)\n(?:      properties:.*\n(?:        .*\n)*)?", lambda m: m[1] + "\n      properties: " + json.dumps(host_properties) + "\n", spec_text)
spec.write_text(spec_text)
# Retain access to the existing companion store for island interactions.
entitlements = {"com.apple.security.application-groups": ["group.com.hikovo.sanhaotu.companion"]} if use_group else {}
if use_weather: entitlements["com.apple.developer.weatherkit"] = True
(live / "LiveActivity.entitlements").write_bytes(plistlib.dumps({"com.apple.security.application-groups": ["group.com.hikovo.sanhaotu.companion"]} if use_group else {}))
subprocess.run([shutil.which("xcodegen") or "/opt/homebrew/bin/xcodegen", "generate", "--spec", str(spec)], cwd=apple, check=True)
(apple / "sanhao-tune_iOS/sanhao-tune_iOS.entitlements").write_bytes(plistlib.dumps(entitlements))
text = project.read_text()
layered_icon = app.parent / "SanhaoIcon.icon"
if layered_icon.exists():
    shutil.copytree(layered_icon, apple / "SanhaoIcon.icon", dirs_exist_ok=True)
    # Xcode's public file type routes .icon packages into the asset compiler.
    if "/* SanhaoIcon.icon in Resources */ =" not in text:
        text = text.replace("/* Begin PBXBuildFile section */", "/* Begin PBXBuildFile section */\n\t\tA8519CC9180E4432AC56B101 /* SanhaoIcon.icon in Resources */ = {isa = PBXBuildFile; fileRef = A8519CC9180E4432AC56B102 /* SanhaoIcon.icon */; };")
        text = text.replace("/* Begin PBXFileReference section */", '/* Begin PBXFileReference section */\n\t\tA8519CC9180E4432AC56B102 /* SanhaoIcon.icon */ = {isa = PBXFileReference; lastKnownFileType = folder.iconcomposer.icon; path = SanhaoIcon.icon; sourceTree = "<group>"; };')
        text = text.replace("\t\t\t\t467956BA5538BFC46328DCF2 /* Assets.xcassets */,", "\t\t\t\t467956BA5538BFC46328DCF2 /* Assets.xcassets */,\n\t\t\t\tA8519CC9180E4432AC56B102 /* SanhaoIcon.icon */,")
        text = text.replace("\t\t\t\tE9F7DDAF5A270AC04B792592 /* Assets.xcassets in Resources */,", "\t\t\t\tE9F7DDAF5A270AC04B792592 /* Assets.xcassets in Resources */,\n\t\t\t\tA8519CC9180E4432AC56B101 /* SanhaoIcon.icon in Resources */,")
    text = text.replace("ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;", "ASSETCATALOG_COMPILER_APPICON_NAME = SanhaoIcon;")
# Only the app's explicit name changes; inherited target names remain intact.
text = text.replace('PRODUCT_NAME = "好好想想";', 'PRODUCT_NAME = sanhaotu;')
text = re.sub(r'shellScript = ".*?ios xcode-script.*?";',
              lambda _: "shellScript = " + json.dumps(script) + ";", text)
project.write_text(text)

yml = apple / "project.yml"
text = yml.read_text().replace("PRODUCT_NAME: 好好想想", "PRODUCT_NAME: sanhaotu")
if layered_icon.exists():
    if "- path: SanhaoIcon.icon" not in text:
        text = text.replace("      - path: Assets.xcassets", "      - path: Assets.xcassets\n      - path: SanhaoIcon.icon\n        buildPhase: resources")
    text = text.replace("ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon", "ASSETCATALOG_COMPILER_APPICON_NAME: SanhaoIcon")
text = re.sub(r"(?m)^      - script: .*ios xcode-script.*$", lambda _: "      - script: " + script, text)
if "UIApplicationSceneManifest:" not in text:
    text = text.replace("        LSRequiresIPhoneOS: true", """        CFBundleDisplayName: 好好想想
        UIApplicationSceneManifest:
          UIApplicationSupportsMultipleScenes: false
          UISceneConfigurations:
            UIWindowSceneSessionRoleApplication:
              - UISceneConfigurationName: TaoScene
        LSRequiresIPhoneOS: true""")
yml.write_text(text)

plist = apple / "sanhao-tune_iOS/Info.plist"
with plist.open("rb") as handle:
    values = plistlib.load(handle)
with (app / "src-tauri/Info.ios.plist").open("rb") as handle:
    values.update(plistlib.load(handle))
values["RabbitSharedRecordsEnabled"] = use_group
for key in ["BAAppGroupID","BAHasManagedAssetPacks","BAUsesAppleHosting"]:
    values.pop(key,None)
if use_hosted_model:
    values["BAAppGroupID"]="group.com.hikovo.sanhaotu.companion"
    values["BAHasManagedAssetPacks"]=True
    values["BAUsesAppleHosting"]=True
values["RabbitWeatherEnabled"] = use_weather
values["NSSupportsLiveActivities"] = True
values.pop("NSSupportsLiveActivitiesFrequentUpdates", None)
values["NSLocationWhenInUseUsageDescription"] = "查看当地冷暖晴雨和日出日落时间，给你天气小叮咛，也让房间灯光随日夜变化。定位仅用于获取苹果天气。"
with plist.open("wb") as handle:
    plistlib.dump(values, handle)

icons = apple / "Assets.xcassets/AppIcon.appiconset"
for icon in (app / "src-tauri/icons/ios").glob("*.png"):
    shutil.copy2(icon, icons / icon.name)
print("Xcode 配置、单窗口场景和三好兔图标已同步。")
