import { definePlugin } from "@tau/plugins";
import { createQwenInstance, parseConfig } from "./provider";
import { QWEN_TTS_MODELS } from "./catalog";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.tts.register({
        id: context.pluginId,
        name: __PLUGIN_META__.name,
        create: (config, model) =>
          createQwenInstance(
            context.fetch,
            context.upload.uploadRemote,
            config,
            model,
          ),
      });
      context.settings.register({
        id: "tts",
        title: __PLUGIN_META__.name,
        target: "tts",
        models: QWEN_TTS_MODELS.map(id => ({ id })),
        form: {
          groups: [{
            title: "账号",
            description: "合成的文本会发送到阿里云百炼语音服务。",
            fields: [
              { key: "apiKey", label: "API Key", type: "secret", description: "在阿里云百炼控制台获取" },
              { key: "baseUrl", label: "服务地址", type: "url", optional: true, placeholder: "https://dashscope.aliyuncs.com", description: "留空使用官方地址；使用国际站或代理时填写", summary: true },
            ],
          }],
          beforeSave: async values => parseConfig(values),
        },
      });
    },
  }),
});
