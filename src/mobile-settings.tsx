import type { PluginSettingsProps } from "@tau/plugins";
import { ConfigurationPanel, type ConfigurationField } from "@tau/ui";
import { parseConfig } from "./provider";
import { QWEN_TTS_MODELS } from "./catalog";

const accountFields: readonly ConfigurationField[] = [
  {
    key: "apiKey",
    label: "API Key",
    type: "password",
  },
  {
    key: "baseUrl",
    label: "服务地址",
    placeholder: "可选，留空使用官方地址",
  },
];

export function MobileSettings({ ttsConfig }: PluginSettingsProps) {
  if (!ttsConfig) return <p>请在语音设置中配置账号。</p>;
  const value = ttsConfig.value;
  const saved =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const initialValue = {
    apiKey: typeof saved.apiKey === "string" ? saved.apiKey : "",
    baseUrl: typeof saved.baseUrl === "string" ? saved.baseUrl : "",
  };
  return (
    <ConfigurationPanel
      initialValue={initialValue}
      accountFields={accountFields}
      fields={[]}
      onSave={async value => {
        const config = parseConfig(value);
        const models = ttsConfig.models.length
          ? ttsConfig.models
          : QWEN_TTS_MODELS.map(id => ({ id }));
        await ttsConfig.save(config, models);
      }}
    />
  );
}
