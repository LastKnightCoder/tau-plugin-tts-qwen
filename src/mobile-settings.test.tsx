import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { PluginContext, PluginSettingsProps } from "@tau/plugins";
import type { ConfigurationField } from "@tau/ui";
import plugin from "./index";
import { MobileSettings } from "./mobile-settings";
import { QWEN_TTS_MODELS } from "./catalog";

const fixture = vi.hoisted(() => {
  (globalThis as { __PLUGIN_META__?: Record<string, string> }).__PLUGIN_META__ = {
    id: "tau.tts-qwen",
    name: "Qwen",
    version: "test",
  };
  return {
    platform: "android" as "desktop" | "android",
    panel: vi.fn(),
    registerSettings: vi.fn(),
  };
});

vi.mock("@tau/plugins", () => ({
  definePlugin: (definition: unknown) => definition,
  usePluginEnvironment: () => ({ platform: fixture.platform }),
}));

vi.mock("@tau/ui", () => ({
  ConfigurationPanel: (props: unknown) => {
    fixture.panel(props);
    return <div data-testid="configuration-panel" />;
  },
  Button: ({ children, loading: _loading, variant: _variant, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: any) => <input {...props} />,
  SettingRow: ({ title, children }: any) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));

type TtsConfig = NonNullable<PluginSettingsProps["ttsConfig"]>;
interface PanelProps {
  initialValue: Record<string, string>;
  accountFields: readonly ConfigurationField[];
  fields: readonly ConfigurationField[];
  onSave(value: Record<string, string>): Promise<void>;
}

function createProps(models: TtsConfig["models"], save: TtsConfig["save"]): PluginSettingsProps {
  return {
    context: { signal: new AbortController().signal } as PluginContext,
    ttsConfig: {
      instanceId: "qwen",
      value: { apiKey: "saved-key", baseUrl: "https://saved.test" },
      models,
      save,
    },
  };
}

function renderPanel(props: PluginSettingsProps): PanelProps {
  fixture.panel.mockClear();
  renderToStaticMarkup(<MobileSettings {...props} />);
  expect(fixture.panel).toHaveBeenCalledOnce();
  return fixture.panel.mock.calls[0][0] as PanelProps;
}

function registeredSettings(): ComponentType<PluginSettingsProps> {
  fixture.registerSettings.mockClear();
  plugin.create().activate({
    pluginId: "tau.tts-qwen",
    fetch: vi.fn(),
    signal: new AbortController().signal,
    tts: { register: vi.fn() },
    settings: { register: fixture.registerSettings },
    upload: { uploadRemote: vi.fn() },
  } as unknown as PluginContext);
  return fixture.registerSettings.mock.calls[0][0].component as ComponentType<PluginSettingsProps>;
}

beforeEach(() => {
  fixture.platform = "android";
  fixture.panel.mockClear();
  fixture.registerSettings.mockClear();
});

it("移动账号表单从已存配置初始化并保留已有模型", async () => {
  const models = [{ id: "custom-model", label: "自定义模型" }];
  const save = vi.fn<TtsConfig["save"]>().mockResolvedValue(undefined);
  const panel = renderPanel(createProps(models, save));
  expect(panel.initialValue).toEqual({ apiKey: "saved-key", baseUrl: "https://saved.test" });
  expect(panel.accountFields).toEqual([
    expect.objectContaining({ key: "apiKey", type: "password" }),
    expect.objectContaining({ key: "baseUrl", placeholder: "可选，留空使用官方地址" }),
  ]);
  expect(panel.fields).toEqual([]);
  await panel.onSave({ apiKey: " new-key ", baseUrl: "https://proxy.test/" });
  expect(save).toHaveBeenCalledWith(
    { apiKey: "new-key", baseUrl: "https://proxy.test" },
    models,
  );
  expect(save.mock.calls[0][1]).toBe(models);
});

it("移动账号表单没有模型时写入预设目录", async () => {
  const save = vi.fn<TtsConfig["save"]>().mockResolvedValue(undefined);
  const panel = renderPanel(createProps([], save));
  await panel.onSave({ apiKey: "key", baseUrl: "" });
  expect(save).toHaveBeenCalledWith(
    { apiKey: "key", baseUrl: "" },
    QWEN_TTS_MODELS.map(id => ({ id })),
  );
});

it("移动账号表单透传校验与保存错误", async () => {
  const failure = new Error("存储写入失败");
  const save = vi.fn<TtsConfig["save"]>().mockRejectedValue(failure);
  const panel = renderPanel(createProps([], save));
  await expect(panel.onSave({ apiKey: "key", baseUrl: "" })).rejects.toBe(failure);
  await expect(panel.onSave({ apiKey: "", baseUrl: "" })).rejects.toThrow("请填写百炼API Key");
  expect(save).toHaveBeenCalledTimes(1);
});

it("设置组件在移动环境使用账号面板，桌面保留原表单", () => {
  const SettingsView = registeredSettings();
  const props = createProps([], vi.fn<TtsConfig["save"]>().mockResolvedValue(undefined));
  const mobile = renderToStaticMarkup(<SettingsView {...props} />);
  expect(mobile).toContain('data-testid="configuration-panel"');
  fixture.panel.mockClear();
  fixture.platform = "desktop";
  const desktop = renderToStaticMarkup(<SettingsView {...props} />);
  expect(desktop).toContain('aria-label="Qwen API Key"');
  expect(desktop).not.toContain('data-testid="configuration-panel"');
  expect(fixture.panel).not.toHaveBeenCalled();
});
