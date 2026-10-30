<!-- © 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
<p align="center">
  <a href="https://www.dudoxx.com">
    <img src="public/logo.png" alt="Dudoxx" width="96" />
  </a>
</p>

<h1 align="center">icedLiquid</h1>

<p align="center">
  <strong>A voice assistant that listens, thinks and speaks inside your browser tab.</strong><br/>
  <em>Built on LFM3-Omni by <a href="https://www.liquid.ai">Liquid AI</a>. All model work runs on WebGPU, on your own machine.</em>
</p>

<p align="center">
  <a href="#status"><img alt="Status" src="https://img.shields.io/badge/status-alpha-C8A24A?style=flat-square"/></a>
  <a href="#license"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-1f6feb?style=flat-square"/></a>
  <a href="https://www.dudoxx.com"><img alt="Built by Dudoxx" src="https://img.shields.io/badge/built%20by-Dudoxx-1f6feb?style=flat-square"/></a>
</p>

---

## What it is

icedLiquid is a small Next.js app with one screen: a voice assistant.
You press **Start talking**, ask a question, and icedLiquid answers out loud.

- **Ears, brain and voice run in the browser.** The LFM3-Omni model by
  [Liquid AI](https://www.liquid.ai) (ONNX, q4f16) runs on WebGPU in the tab.
  Speech recognition, the answer and the spoken reply never leave your machine.
- **Tools run on your local server.** Weather, time, web search and image
  generation are server routes. Your API keys stay on the server and never
  reach the browser.
- **No made-up answers.** If a tool has no key, the agent says the tool is not
  available. It does not invent a temperature or a time.
- **Four languages.** English, German, French and Spanish. You can also say
  "speak German" to switch.
- Light and dark theme, a full-screen stage, barge-in (talk over it to
  interrupt), and a typed chat input.

The model weights are not in this repository. One command downloads them
from Hugging Face (see [Quick start](#quick-start)).

## Screenshots

| Light, ready | Light, weather answer |
|---|---|
| <img src="docs/screenshots/light-idle.png" alt="icedLiquid stage in light mode, ready to listen" width="420" /> | <img src="docs/screenshots/light-weather-answer.png" alt="icedLiquid answers a weather question with a weather card" width="420" /> |

| Dark, full screen | Dark, mobile |
|---|---|
| <img src="docs/screenshots/dark-fullscreen.png" alt="icedLiquid full-screen stage in dark mode with weather and web search cards" width="420" /> | <img src="docs/screenshots/mobile-dark.png" alt="icedLiquid on a narrow screen in dark mode while it speaks" width="200" /> |

## Requirements

| You need | Why |
|---|---|
| Desktop **Chrome** or **Edge**, current version, with **WebGPU** on | The model runs on WebGPU. Check `chrome://gpu`. |
| **Apple Silicon** Mac, or a PC with a discrete GPU | The model needs a capable GPU and enough GPU memory. |
| About **2.5 GB** free disk, plus the same again in browser storage | Weights on disk (server) and a copy in the browser cache (OPFS). |
| **Node.js 24** or newer (see `.nvmrc`) | Runs Next.js and the download script. |
| **pnpm** (version pinned in `package.json`; `corepack enable` gets it) | Installs the packages. |
| A microphone | The agent listens to you. You can also type. |

API keys are optional. Without them the voice agent still works; only the
tools that need a key say they are not available.

## Quick start

```bash
git clone https://github.com/Dudoxx/icedliquid.git
cd icedliquid
pnpm install
cp .env.example .env.local
pnpm models:provision
pnpm dev
```

Then open **http://localhost:3400/en/voice-agent** in Chrome or Edge.

1. `pnpm install` installs the packages.
2. `cp .env.example .env.local` creates your local settings file. Add keys
   now or later (see [Environment keys](#environment-keys)).
3. `pnpm models:provision` downloads the voice model set (16 files, about
   2.45 GB) from Hugging Face at a pinned revision into `models/webgpu-onnx/`.
   It checks the sha256 of every file. Run it again to resume or repair; it
   keeps files that are already correct.
4. `pnpm dev` starts the app on `127.0.0.1:3400` (this computer only). It first copies the
   onnxruntime-web runtime files into `public/ort/`.
5. On the first visit the browser loads the weights from your server into its
   own cache. The next visits start from that cache.
6. Press **Start talking** and allow the microphone.

Other languages: `/de/voice-agent`, `/fr/voice-agent`, `/es/voice-agent`.

Production build and hosting: see [INSTALLATION.md](INSTALLATION.md).

## Environment keys

All keys live in `.env.local`. They are read only on the server. Every key is
optional; an empty value means "not set".

| Key | Used by | Without it |
|---|---|---|
| `WEATHER_API_KEY` | `get_weather`, and `get_time` for a place ([WeatherAPI.com](https://www.weatherapi.com/signup.aspx)) | Weather is off. Time works only for a time zone name, not for a city. |
| `WEATHER_API_BASE_URL` | WeatherAPI base URL | `https://api.weatherapi.com/v1` |
| `EXA_API_KEY` | `web_search` ([Exa](https://dashboard.exa.ai)) | Web search is off. |
| `EXA_BASE_URL` | Exa base URL | `https://api.exa.ai` |
| `OPENROUTER_API_KEY` | `generate_image` ([OpenRouter](https://openrouter.ai/keys)) | Image generation is off. |
| `OPENROUTER_BASE_URL` | OpenRouter base URL | `https://openrouter.ai/api/v1` |
| `MODELS_DIR` | Folder the model route serves the weights from | `models/webgpu-onnx` in this repo |
| `ALLOWED_HOSTS` | Extra host names the tools route accepts, comma separated ([details](docs/CONFIGURATION.md#server-environment-guards)) | Only `localhost`, `127.0.0.1` and `[::1]` |

A tool without its key answers `tool_unavailable` to the model, and the agent
tells you so. A malformed URL value stops the server at start and names the key.

`pnpm models:provision` does not read `.env.local`. It reads `MODELS_DIR` and
`HF_TOKEN` (only needed if Hugging Face asks you to sign in) from your shell:

```bash
MODELS_DIR=/data/icedliquid-models pnpm models:provision
```

If you change the folder, set the same `MODELS_DIR` in `.env.local` so the
server finds the files.

Model, voice and behaviour settings are in `config/icedliquid.json`. Every key
is explained in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Troubleshooting

| You see | Do this |
|---|---|
| The GPU line under the stage never says ready, or shows a WebGPU error | Open `chrome://gpu` and look for "WebGPU: Hardware accelerated". Update Chrome or Edge and your GPU driver. If it is off, turn on hardware acceleration in the browser settings. icedLiquid is built and tested for desktop Chrome and Edge. |
| A model file answers 404 `MODEL_FILE_MISSING` | The weights are not downloaded. Run `pnpm models:provision`. If you use `MODELS_DIR`, give the script the same folder as `.env.local`. |
| The download stops or a sha256 check fails | Run `pnpm models:provision` again. It keeps the good files and fetches the rest. |
| Browser storage is full, or loading fails after an update | The weights are cached in the browser (OPFS). Free disk space, or clear the site data: DevTools > Application > Storage > **Clear site data**. Then reload. |
| No microphone prompt, or the mic stays silent | Allow the microphone for the site (lock icon in the address bar), and check the input device in your system settings. |
| Mic and WebGPU do not work on `http://<your-ip>:3400` | Browsers allow the microphone and WebGPU only in a secure context: `http://localhost` or HTTPS. Use `localhost`, or serve the app over HTTPS (see [INSTALLATION.md](INSTALLATION.md)). |
| The agent says a tool is not available (`tool_unavailable`) | Add the matching key to `.env.local` (see the table above) and restart `pnpm dev`. |
| A tool call answers 403 `CROSS_ORIGIN` | The tools route accepts only same-origin calls. Behind a reverse proxy, forward the original `Host` header. |
| `copy-ort-assets: cannot read ...` at start | Run `pnpm install` first. |

## Project layout

```
config/icedliquid.json   model, voice and tool settings
messages/<locale>/       UI text (en, de, fr, es)
scripts/                 provision-models.mjs, copy-ort-assets.mjs
src/app/[locale]/        pages (voice-agent)
src/app/api/             agent-tools/[tool] and models/[...file] routes
src/lib/webgpu/          in-browser ONNX engine (worker, cache)
src/lib/voice-agent/     listen / think / speak loop
docs/                    configuration, branding, screenshots
```

## Status

Alpha. One screen, one model, desktop browsers with WebGPU. Issues and pull
requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

icedLiquid exists because [Liquid AI](https://www.liquid.ai) released
LFM3-Omni as an open model. Thank you to the Liquid AI team.
icedLiquid is an independent Dudoxx project, not a Liquid AI product.

Branding: [docs/BRANDING.md](docs/BRANDING.md).

## License

The code is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

The LFM3-Omni model weights are **not** in this repository and are **not**
under Apache-2.0. They keep their own license, the LFM Open License v1.0,
named on the [Hugging Face model card](https://huggingface.co/LiquidAI/LFM3-Omni-2B-ONNX).
Read it before you use or ship the weights.

---

<p align="center">
  <a href="https://www.dudoxx.com"><img src="public/logo.png" alt="Dudoxx" width="32" /></a><br/>
  <sub>© 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous</sub>
</p>
