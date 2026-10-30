<!-- © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# icedLiquid

## What icedLiquid is

icedLiquid is an open-source voice assistant by Dudoxx and Acceleate, built on
Liquid AI's LFM3-Omni model. It is a small Next.js app with one screen: you
press Start talking, ask a question, and icedLiquid answers out loud. The code
is Apache-2.0; the model weights keep their own license.

Source: https://github.com/Dudoxx/icedliquid

## How it works

The ears, the brain and the voice all run in the browser tab on WebGPU, with
onnxruntime-web. The audio encoder of LFM3-Omni turns your speech into text
(speech recognition), the decoder writes the answer, and the depth decoder plus
the codec decoder turn the answer into speech. Your voice and the answer never
leave your machine. The weights load once from your own server and are then
cached in the browser.

## Tools

The assistant can call tools: get_weather, get_time, web_search and
generate_image run on the local server, so API keys never reach the browser.
set_theme, set_locale and end_session run in the page. Without API keys the
server tools run in demo mode: weather comes from the free Open-Meteo service,
web search reads these bundled knowledge files, and image generation shows a
bundled sample picture. Every demo result says so.

## Languages

icedLiquid speaks English, German, French and Spanish. Say "speak German" (or
the same in another language) to switch. Each language has its own system
prompt, greeting and tool follow-up text in config/icedliquid.json.

## Features

Light and dark theme, a full-screen stage, barge-in (talk over the assistant to
interrupt it), a typed chat input, and tool cards for weather, web results and
images. If a tool fails, the assistant says what failed instead of guessing.
