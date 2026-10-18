import type { JsonValue, PluginUpload, TTSInstance } from "@tau/plugins";
import { qwenSynthesize, qwenGetVoiceList, qwenCloneVoice } from "./requests";
export function parseConfig(value: JsonValue) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.apiKey !== "string" ||
    !value.apiKey.trim()
  )
    throw new Error("请填写百炼API Key");
  const baseUrl =
    typeof value.baseUrl === "string"
      ? value.baseUrl.trim().replace(/\/+$/, "")
      : "";
  if (baseUrl && !["http:", "https:"].includes(new URL(baseUrl).protocol))
    throw new Error("服务地址必须为HTTP(S)");
  return { apiKey: value.apiKey.trim(), baseUrl };
}
export function createQwenInstance(
  fetch: typeof globalThis.fetch,
  uploadRemote: PluginUpload["uploadRemote"],
  value: JsonValue,
  model: string,
): TTSInstance {
  const config = parseConfig(value);
  if (!model.trim()) throw new Error("请选择语音模型");
  return {
    textInstructions:
      "TTS tags rule:\n- Output plain spoken text only.\n- Do not output pause tags like <#1.2#>.\n- Do not output any parenthesized emotion tags.",
    getVoices: (signal) =>
      qwenGetVoiceList({ ...config, model, fetch, signal }),
    synthesize: (request, signal) =>
      qwenSynthesize(
        { ...config, model, fetch, signal },
        request.text,
        request.voiceId,
        request.options,
      ),
    cloneVoice: async (request, signal) => {
      signal.throwIfAborted();
      if (request.file.content.byteLength > 10 * 1024 * 1024)
        throw new Error("参考音频不能超过10MB");
      if (
        request.file.mimeType &&
        ![
          "audio/wav",
          "audio/mpeg",
          "audio/mp3",
          "audio/mp4",
          "audio/x-m4a",
        ].includes(request.file.mimeType.toLowerCase())
      )
        throw new Error("参考音频仅支持WAV、MP3或M4A");
      const audioUrl = await uploadRemote(request.file, { signal });
      signal.throwIfAborted();
      const stem =
        (request.name || request.requestedId || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 6) || "tau";
      const prefix = stem + Math.random().toString(36).slice(2, 6);
      const id = await qwenCloneVoice(
        { ...config, fetch, signal },
        model,
        audioUrl,
        prefix,
      );
      signal.throwIfAborted();
      return {
        id,
        name: request.name || id,
        type: "cloned",
        description:
          "复刻已提交；服务端可能仍在部署，请刷新音色列表确认就绪后使用。",
      };
    },
  };
}
