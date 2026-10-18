# 开发指南

使用 Node.js 22、pnpm 11.9.0、TypeScript 和公共 SDK 0.13.0。克隆后运行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm build`，产物为 `dist/tau.tts-qwen-0.1.0.zip`。调整版本时同步修改 package.json 和 manifest.json；推送对应版本 tag 后，GitHub Action 自动构建并发布 ZIP 到 Release。

provider测试使用模拟fetch与uploadRemote，不读取用户密钥、不发送收费请求。网络仅通过宿主API，实例固定账号和模型；中止信号贯穿参考文件上传、HEAD、复刻、合成与音频下载。HEAD预检沿用Qwen旧行为，不扩展为所有上传服务的限制。
