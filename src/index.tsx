import { useState } from "react";
import { definePlugin, type PluginSettingsProps } from "@tau/plugins";
import { Button, Input, SettingRow } from "@tau/ui";
import { createQwenInstance, parseConfig } from "./provider";
import { QWEN_TTS_MODELS } from "./catalog";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function Settings({ ttsConfig, context }: PluginSettingsProps) {
  const value = ttsConfig?.value;
  const saved =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const [apiKey, setApiKey] = useState(
    typeof saved.apiKey === "string" ? saved.apiKey : "",
  );
  const [baseUrl, setBaseUrl] = useState(
    typeof saved.baseUrl === "string" ? saved.baseUrl : "",
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!ttsConfig) return <p>请在语音设置中配置账号。</p>;
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const config = parseConfig({ apiKey, baseUrl });
      const models = ttsConfig.models.length
        ? ttsConfig.models
        : QWEN_TTS_MODELS.map((id) => ({ id }));
      context.signal.throwIfAborted();
      await ttsConfig.save(config, models);
      if (!context.signal.aborted) setMessage("账号配置已保存");
    } catch (error) {
      if (!context.signal.aborted)
        setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      if (!context.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      <SettingRow title="API Key">
        <Input
          className="w-full"
          aria-label="Qwen API Key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </SettingRow>
      <SettingRow title="服务地址">
        <Input
          className="w-full"
          aria-label="Qwen服务地址"
          value={baseUrl}
          placeholder="留空使用官方地址"
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </SettingRow>
      <SettingRow title="">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" loading={busy} onClick={() => void save()}>
            保存账号
          </Button>
          {message && (
            <p className="text-tau-meta" role="status">
              {message}
            </p>
          )}
        </div>
      </SettingRow>
    </>
  );
}
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
        component: Settings,
      });
    },
  }),
});
