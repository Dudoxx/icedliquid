<!-- © 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# Configuration: `config/icedliquid.json`

This file holds the model, voice and tool settings. API keys are **not** here;
they are in `.env.local` (see [README > Environment keys](../README.md#environment-keys)).

## How the file is checked

- The app reads the file once, at start, and checks it with a strict schema
  (`src/config/schema.ts`).
- Every key is required. An unknown key, a missing key or a wrong type stops
  the app with an error that names each bad key path. Nothing gets a default.
- `pnpm models:provision` reads the `webgpu` block too, so a change to the
  model files changes what it downloads.
- Restart `pnpm dev` (or rebuild for production) after a change.

Units: `_ms` = milliseconds, `_db` / `dbfs` = decibels relative to full scale
(0 is the loudest, more negative is quieter).

## `webgpu`: model files

| Key | Value now | Meaning |
|---|---|---|
| `files_base` | `/api/models` | Path the browser loads model files from. It must match the model route `src/app/api/models/[...file]`. |
| `hf_base_url` | `https://huggingface.co` | Hugging Face address for the download script. |
| `hf_repo` | `LiquidAI/LFM3-Omni-2B-ONNX` | Model repository on Hugging Face. |
| `hf_revision` | `7d6bd3f…` (40 hex) | Pinned commit of the model repository. Must be a full 40-character sha. |
| `onnx_dir` | `onnx` | Folder of the ONNX graphs inside the model repository. |
| `decoder` | `decoder_q4f16` | Stem of the main decoder graph (the "brain"). |
| `prefill_chunk_tokens` | `1024` | The prompt is fed to the decoder in chunks of this many tokens. |
| `max_tokens` | `2000` | Upper limit of tokens the engine generates for one request. |
| `graphs.audio_encoder` | `audio_encoder` | Stem of the audio-in graph (the "ears"). |
| `graphs.codec_decoder` | `codec_decoder` | Stem of the speech codec graph (the "voice"). |
| `graphs.depth_decoder` | `depth_decoder` | Stem of the speech depth graph (the "voice"). |
| `preprocess_files` | 3 JSON files | Processor and audio tokenizer configs, relative to the model root. |

Each graph stem means two files: `<onnx_dir>/<stem>.onnx` and
`<onnx_dir>/<stem>.onnx_data`. The model route serves only the files this
block names.

## `sampling`: model sampling

| Key | Meaning |
|---|---|
| `text_temperature` | Randomness of the text answer. `0.0` = always the most likely token. |
| `audio_temperature` | Randomness of the generated speech tokens. |
| `audio_repetition_penalty` | Penalty against repeated speech tokens (higher = less repetition). |

## `asr_live`: listening and speech segmentation

These keys control how the browser cuts the microphone stream into
utterances and shows interim text.

| Key | Meaning |
|---|---|
| `language` | Default language code. The voice session replaces it with the page locale. |
| `sample_rate` | Microphone sample rate the engine works at (Hz). |
| `frame_ms` | Length of one audio frame for the level meter. |
| `interim_interval_ms` | How often interim (live) text is recomputed while you speak. |
| `min_first_audio_ms` | Audio needed before the first interim text. |
| `min_new_audio_ms` | New audio needed before the next interim text. |
| `agreement` | Number of interim results that must agree before a word counts as stable. |
| `endpoint_silence_ms` | Silence after speech that ends the utterance. |
| `max_utterance_ms` | Longest utterance. A longer one is cut. |
| `cut_search_ms` | When cutting a long utterance, the window searched for the quietest point. |
| `vad.calibration_ms` | Time at start used to measure the room noise floor. |
| `vad.start_threshold_db` | Level above which speech can start. |
| `vad.stop_threshold_db` | Level below which speech counts as stopped. |
| `vad.noise_margin_db` | Speech must be this far above the measured noise floor. |
| `vad.noise_alpha` | How fast the noise floor follows the room (0 to 1, small = slow). |
| `vad.speech_start_ms` | Loud audio needed before speech counts as started. |
| `vad.pre_roll_ms` | Audio kept from before the start, so the first syllable is not lost. |

## `voice_agent`: the assistant

### Identity and prompts

| Key | Meaning |
|---|---|
| `name` | Name of the assistant (`icedLiquid`). |
| `asr_lane` | Where speech recognition runs. Only `browser` is allowed. |
| `system_prompt` | System prompt of the answer turn. `{language}` is replaced with the session language. |
| `tool_followup` | Message sent after a tool call. `{results}` = tool results, `{language}` = session language. |
| `asr_system` | System prompt of the speech recognition turn. |
| `tts_system` | System prompt of the speech turn. `{voice}` = the locale's `tts_voice`. |

### `locales`

One entry per page locale (`en`, `de`, `fr`, `es`):

| Key | Meaning |
|---|---|
| `language` | Language name used in the prompts (`English`, `German`, ...). |
| `tts_voice` | Voice description for the speech turn (`American English`, ...). |
| `greeting` | What the assistant says when you press Start talking. |
| `ungrounded_answer` | What it says when it would have to guess a number no tool gave it. |

A new locale also needs a full `messages/<code>/` folder and an entry in
`src/i18n/types.ts`.

### Language switch

| Key | Meaning |
|---|---|
| `locale_switch.verbs` | Words that start a switch ("speak", "sprich", "parle", ...). |
| `locale_switch.names.<locale>` | Names of each language in all languages ("german", "deutsch", ...). |

"Speak German" = a verb plus a name, so the session switches to `de`.

### Budgets

| Key | Meaning |
|---|---|
| `max_tool_rounds` | Most tool calls in one turn before the assistant must answer. |
| `answer_max_tokens` | Token limit of the text answer. |
| `speech_max_tokens` | Token limit of the spoken reply. |
| `history_turns` | Earlier turns kept in the prompt. |
| `asr_max_tokens` | Token limit of one speech recognition result. |

### Turn taking and barge-in

| Key | Meaning |
|---|---|
| `barge_in.enabled` | `true` = you can talk over the assistant to stop it. |
| `barge_in.min_dbfs` | Microphone level needed to interrupt. |
| `barge_in.hold_ms` | How long that level must last. |
| `barge_in.echo_margin_db` | Microphone must be this much above the assistant's own playback level, so its echo does not interrupt it. |
| `echo_tail_ms` | The microphone stays closed this long after the reply ends (speaker delay and room echo). |
| `min_utterance_ms` | Shorter utterances are noise, not a request. |
| `vad.start_threshold_db` | Level above which your speech can start a turn. |
| `vad.noise_margin_db` | Speech must be this far above the noise floor. |
| `vad.speech_start_ms` | Loud audio needed before a turn starts. |

### Phrase lists

| Key | Meaning |
|---|---|
| `phantom_phrases` | Texts speech recognition sometimes "hears" in silence (for example "thanks for watching"). A turn that contains one of these is dropped. |
| `fillers` | Short words ("ok", "hmm", "danke"). Alone, and heard soon after the reply, they are treated as echo or noise. |
| `filler_window_ms` | How soon after the reply a lone filler is dropped. |
| `grounding_markers` | Units and signs (°, %, km/h, €, ...). An answer with a number and one of these, but no tool result, is not trusted. |
| `grounding_nudge` | Message that asks the model to call the right tool instead of guessing. `{language}` = session language. |
| `theme_phrases.dark` / `.light` | Saying one of these switches the screen theme. |
| `goodbye_phrases` | Saying one of these ends the session. |

All phrase lists are matched as whole words, in every language, not only the
page locale.

### `tools`: server tool settings

Read by the server route `src/app/api/agent-tools/[tool]`.

| Key | Meaning |
|---|---|
| `image_model` | OpenRouter model id for `generate_image`. |
| `image_aspect_ratios` | Aspect ratios the image tool accepts. |
| `image_timeout_ms` | Timeout of one image request. |
| `weather_days` | Forecast days returned by `get_weather`. |
| `search_results` | Results returned by `web_search`. |
| `summary_max_chars` | A search result summary is cut to this many characters. |
| `timeout_ms` | Timeout of a weather, time or search request. |
| `default_time_zone` | IANA time zone `get_time` uses when you name no place. |

## Server environment: guards

These settings are not in `config/icedliquid.json`. They are server
environment values (`.env.local`) or fixed in the code.

| Setting | Where | Meaning |
|---|---|---|
| `ALLOWED_HOSTS` | `.env.local` | Comma list of extra host names the tools route accepts (for example `voice.example.com`). `localhost`, `127.0.0.1` and `[::1]` are always allowed, on any port. Any other `Host` gets 403 `CROSS_ORIGIN`. This stops DNS rebinding (a hostile site that points its own name at your computer). |
| `Origin` | fixed | A tools call without an `Origin` header, or with one that is not the `Host`, gets 403 `CROSS_ORIGIN`. |
| Body size | fixed | A tools call body above 16 KB gets 413 `PAYLOAD_TOO_LARGE`. Text arguments are capped too: `query` 500, `prompt` 2000, `location` 200, `caption` 300 characters. |
| Rate limit | fixed | 30 tools calls per client in 5 minutes, then 429 `RATE_LIMITED` with `Retry-After`. The count is in memory and starts again when the server restarts. |

### HSTS

`next.config.ts` sends `Strict-Transport-Security: max-age=63072000`. It
covers only the host that serves the app. `includeSubDomains` and `preload`
are opt-in: add them only when every subdomain of your domain serves HTTPS,
because browsers keep the rule for two years and the preload list is hard to
leave.

