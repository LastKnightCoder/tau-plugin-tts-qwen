import { expect, it, vi } from "vitest";
import { createQwenInstance } from "./provider";
const signal = () => new AbortController().signal;
const json = (data: object) => new Response(JSON.stringify(data));
const file = {
  name: "voice.wav",
  mimeType: "audio/wav",
  content: new Uint8Array([0, 255]),
};
it("合成固定每个账号、模型与参数，下载临时音频为字节", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async (input) =>
      String(input).includes("SpeechSynthesizer")
        ? json({ output: { audio: { url: "https://audio.test/a" } } })
        : new Response(new Uint8Array([0, 255])),
    );
  for (const id of ["a", "b"]) {
    const instance = createQwenInstance(
      fetch,
      vi.fn(),
      { apiKey: id, baseUrl: "https://" + id + ".test" },
      "model-" + id,
    );
    expect(
      await instance.synthesize(
        {
          text: "你好",
          voiceId: "v",
          options: { speed: 1.5, volume: 1, pitch: 0.2 },
        },
        signal(),
      ),
    ).toEqual({ audio: new Uint8Array([0, 255]), mime: "audio/mpeg" });
  }
  const requests = fetch.mock.calls.filter((call) =>
    String(call[0]).includes("SpeechSynthesizer"),
  );
  expect(
    requests.map((call) => new Headers(call[1]?.headers).get("Authorization")),
  ).toEqual(["Bearer a", "Bearer b"]);
  expect(
    requests.map((call) => JSON.parse(call[1]!.body as string).model),
  ).toEqual(["model-a", "model-b"]);
  expect(JSON.parse(requests[0][1]!.body as string).input).toMatchObject({
    rate: 1.5,
    volume: 50,
    pitch: 1.2,
    format: "mp3",
  });
  expect(fetch.mock.calls[1][1]?.headers).toBeUndefined();
});
it("音色按当前模型与部署状态筛选；服务失败仍返回系统音色", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    json({
      output: {
        voice_list: [
          {
            voice_id: "ready",
            target_model: "qwen-audio-3.1-tts-flash",
            status: "OK",
          },
          {
            voice_id: "pending",
            target_model: "qwen-audio-3.1-tts-flash",
            status: "DEPLOYING",
          },
          { voice_id: "other", target_model: "other", status: "OK" },
        ],
      },
    }),
  );
  const instance = createQwenInstance(
    fetch,
    vi.fn(),
    { apiKey: "a" },
    "qwen-audio-3.1-tts-flash",
  );
  const voices = await instance.getVoices(signal());
  expect(
    voices.filter((voice) => voice.type === "cloned").map((voice) => voice.id),
  ).toEqual(["ready"]);
  fetch.mockRejectedValue(new Error("network failure"));
  expect(
    (await instance.getVoices(signal())).every(
      (voice) => voice.type === "system",
    ),
  ).toBe(true);
});
it("复刻复用uploadRemote，验证公开地址后提交，返回真实ID与部署提示", async () => {
  const steps: string[] = [];
  const upload = vi.fn(async () => {
    steps.push("upload");
    return "https://files.test/voice.wav";
  });
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async (_input, init) => {
      steps.push(init?.method || "GET");
      return init?.method === "HEAD"
        ? new Response("")
        : json({ output: { voice_id: "server-generated-id" } });
    });
  const instance = createQwenInstance(
    fetch,
    upload,
    { apiKey: "key", baseUrl: "https://proxy.test" },
    "custom-model",
  );
  const callSignal = signal();
  const voice = await instance.cloneVoice!(
    { file, name: "我的声音" },
    callSignal,
  );
  expect(steps).toEqual(["upload", "HEAD", "POST"]);
  expect(upload).toHaveBeenCalledWith(file, { signal: callSignal });
  expect(fetch.mock.calls[0][1]?.headers).toBeUndefined();
  expect(String(fetch.mock.calls[1][0])).toBe(
    "https://proxy.test/api/v1/services/audio/tts/customization",
  );
  expect(
    JSON.parse(fetch.mock.calls[1][1]!.body as string).input,
  ).toMatchObject({
    target_model: "custom-model",
    url: "https://files.test/voice.wav",
  });
  expect(voice.id).toBe("server-generated-id");
  expect(voice.description).toContain("部署");
});
it("上传取消/失败不继续HEAD或复刻；读取音色时取消不降级为成功", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const controller = new AbortController();
  const upload = vi.fn(async () => {
    controller.abort();
    return "https://files.test/a";
  });
  const instance = createQwenInstance(fetch, upload, { apiKey: "a" }, "model");
  await expect(
    instance.cloneVoice!({ file }, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
  const canceled = new AbortController();
  canceled.abort();
  fetch.mockImplementation(async () => {
    throw canceled.signal.reason;
  });
  await expect(instance.getVoices(canceled.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});
it("公开HEAD失败保持原错误语义，不提交复刻或修改存储权限", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response("", { status: 403 }));
  const instance = createQwenInstance(
    fetch,
    vi.fn(async () => "https://files.test/private"),
    { apiKey: "a" },
    "model",
  );
  await expect(instance.cloneVoice!({ file }, signal())).rejects.toThrow(
    "无法公开访问",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
