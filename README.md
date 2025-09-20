# Mini Assistant

Mini Assistant is a lean Obsidian companion that lets you talk to the AI models you already pay for. Configure up to two OpenAI-compatible providers (OpenAI, Anthropic gateways, OpenRouter, etc.), pick the model IDs you want, and run chat or speech-to-text flows without maintaining multiple plugins.

<a href="https://www.buymeacoffee.com/alfurkat" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;"></a>

## Features

- ⚡ **Chat & Prompt commands** – open a chat modal or run a quick prompt against the provider/model you choose.
- 🎛 **Per-capability providers** – point chat and speech-to-text at different API keys/base URLs.
- 🗣 **Speech capture** – record audio and send it to any transcription model exposed by your provider.
- 📝 **Manual model entry** – type the exact model IDs so you aren’t waiting for dropdowns to be updated.

_Image generation has been intentionally removed to keep the plugin focused and lightweight._

## Getting Started


### Providers
- **Provider 1 / Provider 2** – supply API key + base URL. Empty base URLs default to `https://api.openai.com/v1`.
- Assign which provider handles **Chat** and **Speech** via the dropdowns.

### Models & Behaviour
- **Chat model** – any model ID supported by your chosen provider (e.g. `gpt-4o-mini`, `claude-3-haiku`).
- **Max tokens** – leave blank to let the provider decide; if the provider rejects the field the plugin retries without it.
- **Replace selection** – decide whether prompt responses overwrite or append in Prompt mode.
- **Speech model** – transcription model ID such as `whisper-1` or a gateway equivalent.
- **Input language** – optional ISO-639-1 code to help STT accuracy (`en`, `de`, `tr`, ...).

## Compatibility

- Obsidian 0.15.0 or later.
- Any OpenAI-compatible REST gateway. Tested with OpenAI and Anthropic endpoints; other providers (OpenRouter, Together, etc.) should work if they expose the same routes.
