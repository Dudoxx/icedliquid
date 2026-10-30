<!-- © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# How to run icedLiquid

## Requirements

You need desktop Chrome or Edge with WebGPU on (check chrome://gpu), an Apple
Silicon Mac or a PC with a capable GPU, about 2.5 GB of free disk plus the same
again in browser storage, Node.js 24 or newer, pnpm, and a microphone. API keys
are optional.

## Quick start

Clone the repository, then run pnpm install, cp .env.example .env.local,
pnpm models:provision and pnpm dev. Open http://localhost:3400/en/voice-agent
in Chrome or Edge, press Start talking and allow the microphone. Other
languages are at /de/voice-agent, /fr/voice-agent and /es/voice-agent.

Source: https://github.com/Dudoxx/icedliquid#quick-start

## Model download

pnpm models:provision downloads the voice model set (16 files, about 2.45 GB)
from Hugging Face at a pinned revision into models/webgpu-onnx/ and checks the
sha256 of every file. Run it again to resume or repair a download.

## API keys and demo mode

All keys go in .env.local and stay on the server. WEATHER_API_KEY turns on
WeatherAPI.com weather, EXA_API_KEY turns on Exa web search, and
OPENROUTER_API_KEY turns on OpenRouter image generation. Without a key, each
tool runs in demo mode and says so. Restart pnpm dev after a change.

## Troubleshooting

If the GPU line never says ready, open chrome://gpu and look for WebGPU
hardware acceleration. If a model file answers 404, run pnpm models:provision.
The microphone and WebGPU work only on http://localhost or HTTPS.
