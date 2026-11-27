# Qwen Speech

Read text aloud with Alibaba Cloud Model Studio (Bailian / Tongyi) Text-to-Speech. Choose from built-in voices or clone a custom voice from an audio recording.

## Getting Started

1. Install **Qwen Speech** from the **Plugin Center**, then turn it on under the **Installed** tab on the Plugins page. It takes effect immediately without restarting.
2. Open this plugin's **Settings**, add a Qwen Speech account, and enter your API Key and Service URL.
3. After saving, select your account, model, and voice in **Settings → Speech** (on mobile: **Me → Speech**). Available voices vary by model; when using a custom model, you can enter a voice ID manually.

You can add multiple accounts, each with its own saved settings. Once configured, you can preview a short sample to verify the account works; previewing does not change your selected default voice.

## Voice Cloning

1. First select a remote upload plugin (such as S3 or Alibaba Cloud OSS resource upload) in **Settings → Resource Storage** (on mobile: **Me → Images & Attachments**). Recordings must be uploaded online so Bailian can read them, so **Save Locally** cannot be used.
2. Prepare a clear audio recording in WAV, MP3, or M4A format, up to 10 MB.
3. After cloning finishes, the new voice may take a moment to become available—refresh the voice list and select it.

Uploaded recordings are not deleted automatically, and your storage access permissions are left unchanged.

## FAQ

**Will I still be charged after canceling?** Possibly. Canceling only stops waiting for the result; operations already completed on Bailian's side may still be billed.

## Notes

- Both speech synthesis and voice cloning may incur Bailian usage fees.
- Keep your API Key private—never share it or include it in screenshots or issue reports.
