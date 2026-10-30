<!-- © 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# Tools: how they work and how to add your own

icedLiquid's voice agent can call tools. A tool is a function the model asks
for by name, with JSON arguments. The page runs the tool, gives the result back
to the model, and the model answers from that result.

There are two kinds of tool:

| Kind | Tools now | Runs in |
|---|---|---|
| Server tool | `get_weather`, `get_time`, `web_search`, `generate_image` | The Next.js server (`POST /api/agent-tools/<tool>`). API keys stay on the server. |
| Page tool | `set_theme`, `set_locale`, `end_session` | The browser page. No server call. |

## 1. How one tool call flows

```
model tool spec ──► voice-agent loop ──► POST /api/agent-tools/<tool>?lang=<locale>
(src/lib/voice-agent/   (brain.ts think)       (route guard, then the server module)
 tools.ts)                    ▲                              │
                              │   {ok, …result}              ▼
       tool card ◄── onTool ──┴── follow-up turn ◄── src/lib/server/agent-tools.server.ts
 (components/icedliquid/ToolCards.tsx)
```

1. **Tool spec.** `voiceAgentTools(language)` in `src/lib/voice-agent/tools.ts`
   returns the OpenAI-style function specs (name, description, JSON-schema
   parameters). The brain sends them to the model with every round that may
   call tools.
2. **Voice-agent loop.** `think()` in `src/lib/voice-agent/brain.ts` runs up to
   `voice_agent.max_tool_rounds` rounds. When the model asks for tools, each
   call is reported to the UI (`onTool`), run, and its result goes back to the
   model inside the `tool_followup` text. The next round answers.
3. **Dispatch.** `toolRunner()` in `src/lib/voice-agent/agent.ts` sends a page
   tool to the page handler (`onClientTool` in
   `components/icedliquid/use-icedliquid-session.ts`) and every other tool to
   `callVoiceAgentTool()`, which POSTs the arguments to the route with the
   session locale as `?lang=`.
4. **Route.** `src/app/api/agent-tools/[tool]/route.ts` checks the request
   (see [Request guard](#5-request-guard)), the tool name and the locale, and
   calls `AgentTools.run(tool, args, lang)`.
5. **Server module.** `runAgentTool()` in
   `src/lib/server/agent-tools.server.ts` runs the tool and returns
   `{ok: true, …}` or `{ok: false, error}`. A tool failure is HTTP 200 with
   `ok:false`, so the model can say what failed.
6. **Card.** `ToolCard` in `components/icedliquid/ToolCards.tsx` renders the
   result. `tool-results.ts` narrows each result to the shape its card needs;
   a result that does not match shows the plain tool chip instead.

What the model reads: the whole result JSON, except `image_data_url` (a large
image stays in the UI; the model reads "shown to the user on screen").

## 2. Add your own tool (step by step)

Example: a server tool `get_quote` that returns a quote of the day from a
public JSON API, with no key.

**Step 1: tool spec.** Add an entry to the list in `voiceAgentTools()`
(`src/lib/voice-agent/tools.ts`):

```ts
{
  type: 'function',
  function: {
    name: 'get_quote',
    description:
      'Return a quote of the day when the user asks for a quote or some inspiration, in any language (Zitat; citation; cita).',
    parameters: { type: 'object', properties: {}, required: [] },
  },
},
```

A small model follows the description closely. Name the trigger words in the
four session languages, as the existing tools do.

**Step 2: server code.** In `src/lib/server/agent-tools.server.ts`, add the
name to `AGENT_TOOL_NAMES`, write the function, and dispatch it in
`runAgentTool()`:

```ts
export const AGENT_TOOL_NAMES = ['get_weather', 'get_time', 'web_search', 'generate_image', 'get_quote'] as const;

async function getQuote(cfg: ToolsConfig): Promise<AgentToolResult> {
  const r = await httpJson('https://example.org/quote.json', {}, cfg.timeout_ms, 'Quote API', '');
  if (!r.ok) return r;
  const text = str(rec(r.body)?.['text']);
  return text ? { ok: true, text } : { ok: false, error: 'Quote API returned no quote' };
}

// in runAgentTool():
if (name === 'get_quote') return getQuote(cfg);
```

Use `httpJson()` from `src/lib/server/tool-http.server.ts`: it has a timeout,
never throws, caps the body size and removes a secret from error text. Never
return a made-up value: no data means `{ok: false, error}`.

**Step 3: label.** Add the tool name to `TOOL_NAMES` in `ToolCards.tsx` and a
label `stage.tools.get_quote` to `messages/<locale>/voice.json` in **all four**
locales (en, de, fr, es). Without a label the chip shows the raw name.

**Step 4 (optional): a card.** Add a narrowing function in `tool-results.ts`
(like `asWeather`) and a card component in `ToolCards.tsx`, then pick it in
`ToolCard`. Use semantic Tailwind tokens and `t()` for every visible word.

**Step 5 (optional): settings and keys.** A setting (timeout, count, model id)
goes in `voice_agent.tools` of `config/icedliquid.json` and its strict schema
`voiceAgentToolsSchema` in `src/config/schema.ts` (see
[CONFIGURATION.md](CONFIGURATION.md)). A secret goes in `src/env.ts` (server
only) and `.env.example`, never in the config file.

**A page tool** (runs in the browser): do step 1, add the name to
`CLIENT_TOOLS` in `tools.ts`, and handle it in `onClientTool` in
`use-icedliquid-session.ts`. Return `{ok: true}` or `{ok: false, error}`.

## 3. Demo mode (keyless tools)

The app runs in one shot without any paid key. A server tool whose key is not
set answers in **demo mode** and says so:

| Tool | Key | Without the key |
|---|---|---|
| `web_search` | `EXA_API_KEY` | Searches the bundled `knowledge/*.md` files (Dudoxx, Acceleate, Liquid AI, LFM3, icedLiquid), ranked by word overlap. |
| `get_weather` | `WEATHER_API_KEY` | Live weather from the free [Open-Meteo](https://open-meteo.com) forecast API, in the same card. |
| `get_time` | `WEATHER_API_KEY` | For a place, the time zone comes from the free Open-Meteo geocoder. The time itself is exact. |
| `generate_image` | `OPENROUTER_API_KEY` | A bundled sample picture from `public/demo/`, not a picture of the prompt. |

Every demo result carries these fields:

```json
{ "ok": true, "mode": "demo", "demo_key": "EXA_API_KEY", "source": "local-knowledge",
  "note": "demo mode: no EXA_API_KEY is set, so … Tell the user …" }
```

- The model reads `note` and tells the user it is a demo and which key turns on
  the real service.
- The card shows a **Demo** badge. Its tooltip names the missing key, and a
  line under the card says where the data came from (`stage.demo.*` in
  `messages/<locale>/voice.json`).
- A key that **is** set and fails upstream stays a loud `{ok: false, error}`.
  There is no silent switch to demo data.

To add demo mode to your own tool: when the key is missing, call a free or
bundled source and spread `demoFields(key, source, what)` from
`tool-http.server.ts` into the result. Add the key to `DEMO_KEYS` (server and
`tool-results.ts`) and, for a new source, a line key under `stage.demo.line`
in all four locales.

**Add your own knowledge.** Put a Markdown file in `knowledge/`: a `# Title`,
then `## Section` blocks. A line `Source: https://…` in a section becomes the
link of that hit; otherwise the hit links to the section on GitHub. Restart the
server after a change (the files are read once).

## 4. Environment keys

| Key | Tool | Without it |
|---|---|---|
| `WEATHER_API_KEY` | `get_weather`, `get_time` for a place | Demo mode (Open-Meteo). |
| `EXA_API_KEY` | `web_search` | Demo mode (bundled knowledge). |
| `OPENROUTER_API_KEY` | `generate_image` | Demo mode (bundled picture). |
| `WEATHER_API_BASE_URL`, `EXA_BASE_URL`, `OPENROUTER_BASE_URL` | Base URL overrides | The public default URL. |
| `ALLOWED_HOSTS` | The tools route | Loopback host names only. |

Keys live in `.env.local`, are read only on the server (`src/env.ts`), and
never reach the browser. Restart `pnpm dev` after a change.

## 5. Request guard

`RequestGuard` (`src/lib/server/request-guard.server.ts`) checks every tools
call before the body is read:

- **Host**: loopback names, or a name in `ALLOWED_HOSTS`. Else 403. This stops
  DNS rebinding.
- **Origin**: required, and must be the same origin. Else 403.
- **Size**: body above 16 KB is 413. Text arguments have caps too
  (`MAX_ARG_CHARS` in `agent-tools.server.ts`); a longer value is refused,
  never cut.
- **Rate**: 30 calls per client in 5 minutes, then 429 with `Retry-After`.

A new tool gets all of these for free, because it uses the same route.

## 6. Locale-aware tools

The session locale (en, de, fr, es) reaches every layer:

- **Tool specs.** `voiceAgentTools(language)` gets the session language name
  (`voice_agent.locales.<code>.language`, for example "German"). Text the user
  sees, such as the image caption, is asked for in that language by name. A
  2B model follows "in German" better than "in the user's language".
- **Tool arguments.** The route gets `?lang=<code>`; `runAgentTool(name, args,
  lang)` passes it on. Use it for anything the user sees or hears: condition
  words (`get_weather`), weekday and date words (`get_time`, via
  `Intl.DateTimeFormat`), place names (the geocoder is asked in that language).
- **Units and numbers.** Return raw numbers in metric units (`temp_c`,
  `wind_kph`). The card formats them with `Intl.NumberFormat` in the page
  locale; the model speaks them as words (the system prompt asks it to).
- **Knowledge in one language.** The bundled knowledge is English. The search
  result carries `lang`; the system prompt and `tool_followup` tell the model
  to answer in the session language.

## 7. Meta instructions (prompts)

These texts live in `voice_agent` of `config/icedliquid.json`. `{language}`
and `{voice}` are filled per session from `voice_agent.locales.<code>`
(`src/lib/voice-agent/locale.ts`).

| Key | What it does |
|---|---|
| `system_prompt` | The system turn of every round: persona, "reply in {language}", "call a tool before you state a time, date, weather or anything current", spoken-number rules, which page tool to call for theme, language and goodbye. |
| `tool_followup` | The user turn after a tool round. `{results}` is replaced by the results JSON. It tells the model to answer now, in {language}, from these results, and to say what failed if a result has `ok:false`. |
| `grounding_nudge` | Sent once when an answer holds a data number (a word from `grounding_markers`, such as `°`, `%`, `uhr`) but no tool ran this turn. It asks the model to call the matching tool. |
| `locales.<code>.ungrounded_answer` | Spoken instead of the answer when it is still ungrounded after the nudge: "I could not check that, so I will not guess." |
| `locales.<code>.language` / `tts_voice` / `greeting` | The language name filled into the templates, the speech voice, and the first spoken line. |
| `asr_system`, `tts_system` | The system turns of speech recognition and speech output. |

**Edit per locale.** `system_prompt`, `tool_followup` and `grounding_nudge`
are one template each, filled with the locale's `language`. Write them in
English and keep `{language}` where the answer language matters; a 2B model
follows English instructions most reliably. Per-locale text (greeting,
ungrounded answer) goes in `voice_agent.locales.<code>`. The schema is strict:
a new locale needs a complete `locales.<code>` entry, a
`locale_switch.names.<code>` list, the code in `locales` of
`src/i18n/types.ts` and a full `messages/<code>/` tree.

**Tool descriptions** are code, not config: edit them in
`src/lib/voice-agent/tools.ts`. Keep the trigger words of every language in
the description.
