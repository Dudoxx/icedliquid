<!-- © 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# Installation

This guide installs icedLiquid step by step, first for local use, then for a
production server. The short version is in the [README](README.md#quick-start).

## 1. Check the requirements

| Item | Check |
|---|---|
| Node.js 24 or newer | `node --version` (the repo has an `.nvmrc`: `nvm use`) |
| pnpm | `corepack enable`, then `pnpm --version`. `package.json` pins the version. |
| About 2.5 GB free disk on the server | for the model weights |
| Desktop Chrome or Edge with WebGPU | open `chrome://gpu`, look for "WebGPU: Hardware accelerated" |
| Apple Silicon Mac, or a PC with a discrete GPU | the model runs on the GPU of the computer that opens the page |
| Free browser storage, about 2.5 GB | the browser caches the weights (OPFS) |

The weights run in the **browser**, on the GPU of the visitor. The server only
stores the files and runs the tool routes. It does not need a GPU.

## 2. Get the code and install packages

```bash
git clone https://github.com/Dudoxx/icedliquid.git
cd icedliquid
pnpm install
```

## 3. Create the settings file

```bash
cp .env.example .env.local
```

Open `.env.local` and fill only the keys you need. Every key is optional:

| Key | Turns on |
|---|---|
| `WEATHER_API_KEY` | `get_weather`, and `get_time` for a city name |
| `EXA_API_KEY` | `web_search` |
| `OPENROUTER_API_KEY` | `generate_image` |
| `MODELS_DIR` | a weights folder other than `models/webgpu-onnx` |
| `ALLOWED_HOSTS` | the tools route on a host name other than `localhost` (for example `voice.example.com`) |

The `*_BASE_URL` keys change the service address; leave them empty for the
default. The full list with links to the sign-up pages is in
[README > Environment keys](README.md#environment-keys).

Never commit `.env.local`. Git ignores it.

## 4. Download the model weights

```bash
pnpm models:provision
```

What it does:

- Reads the model repository and the pinned revision from
  `config/icedliquid.json` (`webgpu.hf_repo`, `webgpu.hf_revision`).
- Downloads the voice model set from Hugging Face: 16 files, about 2.45 GB
  (decoder, audio encoder, depth decoder, codec decoder, tokenizer and
  config files).
- Checks the size and sha256 of every file. A file that does not match is
  removed and reported, and the command exits with an error.
- Keeps files that are already correct, so you can run it again to resume.

Options:

| Command | Effect |
|---|---|
| `node scripts/provision-models.mjs --dry-run` | Prints the file list, sizes and sha256. Writes nothing. |
| `node scripts/provision-models.mjs --dry-run --json` | The same plan as JSON. |
| `node scripts/provision-models.mjs --dir <folder>` | Downloads into another folder. |
| `node scripts/provision-models.mjs --help` | Shows the usage. |

The script reads `MODELS_DIR` and `HF_TOKEN` from the shell, not from
`.env.local`. Inside the app folder it writes only under `models/` (that
folder is git-ignored). A folder outside the app is allowed:

```bash
MODELS_DIR=/srv/icedliquid-models pnpm models:provision
```

Then set the same `MODELS_DIR` in `.env.local`, so the server finds the files.

The weights have their own license, the LFM Open License v1.0 by Liquid AI.
See [NOTICE](NOTICE) and the
[Hugging Face model card](https://huggingface.co/LiquidAI/LFM3-Omni-2B-ONNX).

## 5. Run in development

```bash
pnpm dev
```

The app runs on port 3400 and listens on `127.0.0.1` only, so other computers
on your network cannot reach it. Open http://localhost:3400/en/voice-agent.
`pnpm dev` first copies the onnxruntime-web runtime files into `public/ort/`
(git-ignored).

The first visit loads the weights from the server into the browser cache.
Later visits start from that cache.

## 6. Run in production

```bash
pnpm build
pnpm start
```

`pnpm build` copies the runtime files and builds the app. `pnpm start` serves
it on port 3400. Keep `.env.local` (or the same keys as environment variables)
and the weights folder on the server.

### HTTPS is required for other computers

Browsers allow the microphone and WebGPU only in a secure context:
`http://localhost` or HTTPS. A visitor on `http://<server-ip>:3400` gets no
microphone. Put a reverse proxy with a TLS certificate in front of the app.

The proxy must:

- forward the original `Host` header (the tools route refuses calls whose
  `Origin` does not match the host, with 403 `CROSS_ORIGIN`);
- use a host name that is in `ALLOWED_HOSTS` in `.env.local` (for example
  `ALLOWED_HOSTS=voice.example.com`). The tools route accepts only
  `localhost`, `127.0.0.1`, `[::1]` and these names, and refuses any other
  `Host` with 403 `CROSS_ORIGIN`;
- allow large responses and not buffer them, because the model files are
  hundreds of MB each;
- pass the `ETag` and `If-None-Match` headers, so the browser can revalidate
  its cache.

Example for Caddy:

```
voice.example.com {
  reverse_proxy 127.0.0.1:3400
}
```

Example for nginx:

```nginx
server {
  listen 443 ssl;
  server_name voice.example.com;
  # ssl_certificate and ssl_certificate_key here

  location / {
    proxy_pass http://127.0.0.1:3400;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 300s;
  }
}
```

### Paid keys on a public server

The tools route spends your API keys on every call. It accepts only
same-origin browser calls (a call without `Origin` is refused), at most 30
calls per client in 5 minutes (429 `RATE_LIMITED`), and bodies up to 16 KB,
but it has no login. Behind a proxy the client is the last
`X-Forwarded-For` address, so let the proxy set that header. If the server is public, protect it
(for example with basic auth or an allow list at the proxy), or leave the paid
keys empty.

## 7. Check that it works

1. Open `/en/voice-agent`. When loading ends, the GPU line under the stage
   names your GPU.
2. Press **Start talking** and allow the microphone.
3. Ask "What time is it in Tokyo?" (needs `WEATHER_API_KEY`) or type a
   question in the chat box.

If something fails, see [README > Troubleshooting](README.md#troubleshooting).

## Update

```bash
git pull
pnpm install
pnpm models:provision
pnpm build && pnpm start
```

When the pinned revision did not change, `pnpm models:provision` downloads
nothing: it only checks the files you already have.
