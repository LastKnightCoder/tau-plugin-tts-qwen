# 兼容性与开发验证

当前依赖 SDK 0.44.0、UI 0.5.0；插件版本与最低客户端版本以 manifest.json 为准。使用格式 3，同一安装包声明 desktop、android、ios；保留插件 ID、原有数据字段与功能。

## 平台边界

依赖 `context.tts`、宿主 fetch 与 `settings target: "tts"`。移动端 0.2.7 起接入同一接口：账号、模型、当前音色与试听由宿主「我的 → 语音 → 语音合成」统一管理，插件按 `usePluginEnvironment().platform` 在手机上渲染 `mobile-settings.tsx` 的账号表单，桌面表单保持不变。

音色复刻经 `context.upload.uploadRemote` 取得公网地址，两端都需要可公开读取的远端上传服务；本地保存模式下复刻直接失败，不影响普通合成。

跨端能力以[官方 API 支持矩阵](https://github.com/LastKnightCoder/tau-plugin-template/blob/main/docs/api-support.md)为准。增加平台使用同一插件 ID 与更高版本，历史数据保持兼容；不生成另一个移动端专用插件。

## 验证与发布

1. 使用正式 npm 依赖与仓库锁文件执行 `pnpm install --frozen-lockfile`，不注入本地 SDK。
2. 执行 `pnpm test`，再执行 `pnpm build`。
3. 正式用户通过插件中心安装。作者客户端行为验收覆盖启用、原有功能、保存重开与停用；构建或单测通过不等于已完成这些验收。
4. 发布时提高 package.json 与 manifest.json 版本，使用新 tag；不覆盖旧版本。推送 tag 会触发发布工作流，提交源码不等于已经上架。
