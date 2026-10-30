/* Generated scene data for the icedLiquid manual. */
window.PIECE = {
 "brand": "dudoxx",
 "format": "16x9",
 "langs": [
  "en"
 ],
 "defaultLang": "en",
 "title": "icedLiquid: a voice assistant in one browser tab",
 "total": 432,
 "marks": {
  "lockup": "brand/dudoxx-typography.png",
  "mark": "brand/dudoxx-logo.png"
 },
 "chapters": [
  {
   "id": "open",
   "preset": null,
   "duration": 48,
   "label": "Cold open",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": {
    "at": 26.4
   },
   "beats": [
    {
     "preset": "headline",
     "duration": 14,
     "params": {
      "kicker": "One evening · one Mac · one Chrome tab",
      "text": "icedLiquid answers out loud.",
      "accent": "out loud",
      "hook": "Built on LFM3-Omni by Liquid AI · liquid.ai"
     },
     "fx": null,
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "brand-ident-3d",
     "duration": 12,
     "params": {
      "presents": "Dudoxx presents",
      "tagline": "icedLiquid · built on LFM3-Omni by Liquid AI"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 12,
     "params": {
      "kicker": "The product",
      "title": "One page, four views",
      "body": "Real captures of the voice agent page, light and dark.",
      "cards": [
       {
        "title": "Ready",
        "text": "one press loads the model",
        "src": "assets/voice-agent-light-idle.png",
        "icon": "sparkles"
       },
       {
        "title": "A weather turn",
        "text": "card, answer, badges",
        "src": "assets/voice-agent-light-weather.png",
        "icon": "message-circle-more"
       },
       {
        "title": "Full screen",
        "text": "the stage, dark theme",
        "src": "assets/voice-agent-fullscreen-dark.png",
        "icon": "layout-dashboard"
       },
       {
        "title": "On a phone",
        "text": "one column, same tiles",
        "src": "assets/voice-agent-mobile-dark.png",
        "icon": "activity"
       }
      ]
     },
     "fx": null,
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "kpi-trio",
     "duration": 10,
     "params": {
      "kicker": "Measured, not promised",
      "title": "One recorded session",
      "body": "Every figure in this manual is a row in the measurement register.",
      "roll": true,
      "tiles": [
       {
        "value": 12,
        "label": "answered turns"
       },
       {
        "value": 1121.1,
        "decimals": 1,
        "label": "median reply, ms"
       },
       {
        "value": 1477.3,
        "decimals": 1,
        "label": "model from cache, ms"
       }
      ]
     },
     "fx": null,
     "camera": "pull",
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "agenda",
   "preset": null,
   "duration": 14,
   "label": "Agenda",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "agenda",
     "duration": 14,
     "params": {
      "kicker": "Agenda",
      "title": "What follows",
      "body": "From one tab to the honest limits, then how to rerun it.",
      "from": 3,
      "walk": [
       {
        "items": [
         "tab",
         "cache"
        ],
        "label": "The tab"
       },
       {
        "items": [
         "turn",
         "tools",
         "bargein"
        ],
        "label": "A turn"
       },
       {
        "items": [
         "session",
         "limits"
        ],
        "label": "The numbers"
       },
       {
        "items": [
         "reproduce",
         "thanks"
        ],
        "label": "Your turn"
       }
      ]
     },
     "fx": null,
     "camera": "breathe",
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "tab",
   "preset": null,
   "duration": 38,
   "label": "One tab: ears, brain, voice",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "ui-tour",
     "duration": 14,
     "params": {
      "src": "assets/voice-agent-light-idle.png",
      "spots": [
       {
        "x": 5.5,
        "y": 16.4,
        "w": 26.5,
        "h": 4,
        "label": "One model",
        "text": "LFM3-Omni, ONNX, on WebGPU"
       },
       {
        "x": 14.5,
        "y": 60,
        "w": 9,
        "h": 4.6,
        "label": "Start talking",
        "text": "loads the model, opens the mic"
       },
       {
        "x": 5.5,
        "y": 70.5,
        "w": 27,
        "h": 9,
        "label": "Pipeline tiles",
        "text": "ears, brain, tools, voice"
       },
       {
        "x": 5.5,
        "y": 80.4,
        "w": 27,
        "h": 6.2,
        "label": "GPU line",
        "text": "adapter and browser cache"
       },
       {
        "x": 36.5,
        "y": 83.6,
        "w": 43.5,
        "h": 4,
        "label": "Credit",
        "text": "with thanks to Liquid AI"
       }
      ],
      "_aspect": "3200/1800"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 12,
     "params": {
      "kicker": "One model, three jobs",
      "title": "Ears, brain, voice",
      "body": "LFM3-Omni by Liquid AI, running on WebGPU in the tab.",
      "cards": [
       {
        "title": "Ears",
        "text": "speech to text, lane browser",
        "icon": "activity"
       },
       {
        "title": "Brain",
        "text": "reads, picks a tool, writes the reply",
        "icon": "bot"
       },
       {
        "title": "Voice",
        "text": "speech codec tokens, played as they stream",
        "icon": "message-circle-more"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-1",
        "at": 2.93,
        "hold": 2.53
       },
       {
        "target": "card-2",
        "at": 6.21,
        "hold": 1.81
       },
       {
        "target": "card-3",
        "at": 8.77,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "hub",
     "duration": 12,
     "params": {
      "kicker": "Where things run",
      "title": "Audio stays in the tab",
      "body": "Only tool calls leave it, and the tool keys stay on the web server.",
      "center": "One Chrome tab",
      "nodes": [
       "Ears · WebGPU",
       "Brain · WebGPU",
       "Voice · WebGPU",
       "Web server · tools + keys"
      ],
      "packetLabels": [
       "audio",
       "text",
       "speech",
       "tool call"
      ],
      "trail": 3
     },
     "fx": {
      "highlight": [
       {
        "target": "center",
        "at": 2.35,
        "hold": 1.36
       },
       {
        "target": "node-4",
        "at": 4.46,
        "hold": 1.6
       }
      ]
     },
     "camera": null,
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "cache",
   "preset": null,
   "duration": 24,
   "label": "The model from cache",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "counter",
     "duration": 12,
     "params": {
      "value": 1477.3,
      "decimals": 1,
      "kicker": "Model load",
      "title": "From the browser cache",
      "body": "Recorded session, Apple GPU, WebGPU.",
      "note": "milliseconds, cache hit"
     },
     "fx": {
      "highlight": [
       {
        "target": "figure",
        "at": 4.77,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "split-compare",
     "duration": 12,
     "params": {
      "kicker": "Cold and warm",
      "title": "Download once, then read the cache",
      "a": {
       "title": "First visit",
       "points": [
        "downloads the weights once",
        "stores them in the browser cache"
       ]
      },
      "b": {
       "title": "Every later visit",
       "points": [
        "loads from cache, 1477.3 ms",
        "no download"
       ]
      }
     },
     "fx": {
      "highlight": [
       {
        "target": "a",
        "at": 0.71,
        "hold": 1.88
       },
       {
        "target": "b",
        "at": 3.34,
        "hold": 1.6
       }
      ]
     },
     "camera": "pan",
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "turn",
   "preset": null,
   "duration": 56,
   "label": "One turn, end to end",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "diagram",
     "duration": 14,
     "params": {
      "src": "assets/seq-icedliquid-turn.svg",
      "packets": [
       {
        "path": "iced-m1",
        "at": 0.8,
        "label": "speech",
        "arrive": "ears",
        "loop": false
       },
       {
        "path": "iced-m2",
        "at": 1.8,
        "label": "text",
        "arrive": "agent",
        "loop": false
       }
      ],
      "layout": "full",
      "_svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 632\" width=\"1120\" height=\"632\" role=\"img\" aria-labelledby=\"iced-title iced-desc\" class=\"dg-svg\" data-diagram=\"iced\"><title id=\"iced-title\">icedLiquid: one voice turn with a tool call, all models in the tab</title><desc id=\"iced-desc\">icedLiquid hears through the browser WebGPU ASR lane (voice_agent.asr_lane), checks the config phrase lists, thinks on the in-tab LFM3-Omni brain with tool specs, calls /api/agent-tools/&lt;name&gt; on the Next.js server and draws a card, then speaks the answer as streamed speech. Speaking over the answer (barge-in) stops it and the agent listens again.</desc><style>.dg-bg{fill:var(--brand-color-paper,#f9fafd)}\n.dg-mask{fill:var(--brand-color-paper,#f9fafd)}\n.dg-node{fill:#ffffff;stroke:var(--brand-color-fg,#121a2b);stroke-width:1}\n.dg-focal{fill:rgba(10,93,254,0.08);stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.2}\n.dg-store{fill:rgba(18,26,43,0.05);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1}\n.dg-ext{fill:rgba(18,26,43,0.03);stroke:rgba(18,26,43,0.30);stroke-width:1}\n.dg-e{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1.2}\n.dg-e-link{fill:none;stroke:#1046c1;stroke-width:1.2}\n.dg-e-ret{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1;stroke-dasharray:4 3}\n.dg-e-accent{fill:none;stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.4}\n.dg-life{fill:none;stroke:rgba(18,26,43,0.20);stroke-width:1;stroke-dasharray:3 3}\n.dg-act{fill:rgba(18,26,43,0.06);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:0.8}\n.dg-frame{fill:rgba(18,26,43,0.02);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-tab{fill:var(--brand-color-paper,#f9fafd);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-head{fill:var(--brand-color-fg-secondary,#475061)}\n.dg-head-link{fill:#1046c1}\n.dg-head-accent{fill:var(--brand-color-primary,#0a5dfe)}\n.dg-name{fill:var(--brand-color-fg,#121a2b);font-family:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;font-size:12px;font-weight:600}\n.dg-sub{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:9px}\n.dg-lbl{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em}\n.dg-lbl-accent{fill:var(--brand-color-primary,#0a5dfe);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em;font-weight:500}\n.dg-op{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.12em}</style><defs><marker id=\"iced-arrow\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-link\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-link\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-accent\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-accent\" points=\"0 0, 8 3, 0 6\"/></marker></defs><rect class=\"dg-bg\" x=\"0\" y=\"0\" width=\"1120\" height=\"632\"/><g data-step=\"1\"><path id=\"iced-life-you\" class=\"dg-life\" d=\"M100,96 V612\"/><path id=\"iced-life-ears\" class=\"dg-life\" d=\"M284,96 V612\"/><path id=\"iced-life-agent\" class=\"dg-life\" d=\"M468,96 V612\"/><path id=\"iced-life-brain\" class=\"dg-life\" d=\"M652,96 V612\"/><path id=\"iced-life-tools\" class=\"dg-life\" d=\"M836,96 V612\"/><path id=\"iced-life-voice\" class=\"dg-life\" d=\"M1020,96 V612\"/><rect x=\"96\" y=\"128\" width=\"8\" height=\"24\" class=\"dg-act\"/><rect x=\"280\" y=\"128\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"464\" y=\"160\" width=\"8\" height=\"416\" class=\"dg-act\"/><rect x=\"648\" y=\"240\" width=\"8\" height=\"232\" class=\"dg-act\"/><rect x=\"832\" y=\"336\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"1016\" y=\"480\" width=\"8\" height=\"56\" class=\"dg-act\"/><g data-hit=\"you\" id=\"iced-a-you\"><rect x=\"24\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-node\"/><text x=\"100\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">You</text><text x=\"100\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">mic + speaker</text></g><g data-hit=\"ears\" id=\"iced-a-ears\"><rect x=\"208\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"284\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Ears</text><text x=\"284\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">asr_lane: browser</text></g><g data-hit=\"agent\" id=\"iced-a-agent\"><rect x=\"392\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-focal\"/><text x=\"468\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">icedLiquid agent</text><text x=\"468\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">turns · phrase lists</text></g><g data-hit=\"brain\" id=\"iced-a-brain\"><rect x=\"576\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"652\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Brain</text><text x=\"652\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">LFM3-Omni · WebGPU</text></g><g data-hit=\"tools\" id=\"iced-a-tools\"><rect x=\"760\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-ext\"/><text x=\"836\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Agent tools</text><text x=\"836\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">Next.js server</text></g><g data-hit=\"voice\" id=\"iced-a-voice\"><rect x=\"944\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"1020\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Voice</text><text x=\"1020\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">speech codec · WebGPU</text></g></g><g data-step=\"2\"><path id=\"iced-m1\" class=\"dg-e\" d=\"M104,136 H280\" marker-end=\"url(#iced-arrow)\"/><rect x=\"142\" y=\"121\" width=\"100\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"192\" y=\"130\" class=\"dg-lbl\" text-anchor=\"middle\">speech (VAD start)</text></g><g data-step=\"3\"><path id=\"iced-m2\" class=\"dg-e-ret\" d=\"M288,168 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"332\" y=\"153\" width=\"88\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"376\" y=\"162\" class=\"dg-lbl\" text-anchor=\"middle\">final transcript</text></g><g data-step=\"4\"><path id=\"iced-m3\" class=\"dg-e\" d=\"M472,200 H504 Q512,200 512,208 V212 Q512,220 504,220 H476\" marker-end=\"url(#iced-arrow)\"/><text x=\"520\" y=\"213\" class=\"dg-lbl\" text-anchor=\"start\">phrase lists: theme · goodbye · language</text></g><g data-step=\"5\"><path id=\"iced-m4\" class=\"dg-e\" d=\"M472,248 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"490\" y=\"233\" width=\"140\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"242\" class=\"dg-lbl\" text-anchor=\"middle\">think(history, tool specs)</text></g><g data-step=\"6\"><rect x=\"444\" y=\"268\" width=\"420\" height=\"160\" rx=\"4\" class=\"dg-frame\"/><rect x=\"444\" y=\"268\" width=\"40\" height=\"16\" rx=\"2\" class=\"dg-tab\"/><text x=\"464\" y=\"280\" class=\"dg-op\" text-anchor=\"middle\">LOOP</text><rect x=\"492\" y=\"271\" width=\"180\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"496\" y=\"280\" class=\"dg-lbl\" text-anchor=\"start\">[up to voice_agent.max_tool_rounds]</text><path id=\"iced-m5\" class=\"dg-e-ret\" d=\"M648,312 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"530\" y=\"297\" width=\"60\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"306\" class=\"dg-lbl\" text-anchor=\"middle\">tool_calls</text></g><g data-step=\"7\"><path id=\"iced-m6\" class=\"dg-e-link\" d=\"M472,344 H832\" marker-end=\"url(#iced-arrow-link)\"/><rect x=\"580\" y=\"329\" width=\"160\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"338\" class=\"dg-lbl\" text-anchor=\"middle\">POST /api/agent-tools/&lt;name&gt;</text></g><g data-step=\"8\"><path id=\"iced-m7\" class=\"dg-e-ret\" d=\"M832,376 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"596\" y=\"361\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"370\" class=\"dg-lbl\" text-anchor=\"middle\">{ok, data} · draw card</text></g><g data-step=\"9\"><path id=\"iced-m8\" class=\"dg-e\" d=\"M472,408 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"528\" y=\"393\" width=\"64\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"402\" class=\"dg-lbl\" text-anchor=\"middle\">tool result</text></g><g data-step=\"10\"><path id=\"iced-m9\" class=\"dg-e-ret\" d=\"M648,456 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"496\" y=\"441\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"450\" class=\"dg-lbl\" text-anchor=\"middle\">answer · grounding guard</text></g><g data-step=\"11\"><path id=\"iced-m10\" class=\"dg-e\" d=\"M472,488 H1016\" marker-end=\"url(#iced-arrow)\"/><rect x=\"706\" y=\"473\" width=\"76\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"482\" class=\"dg-lbl\" text-anchor=\"middle\">speak(answer)</text></g><g data-step=\"12\"><path id=\"iced-m11\" class=\"dg-e-accent\" d=\"M1016,520 H104\" marker-end=\"url(#iced-arrow-accent)\"/><rect x=\"702\" y=\"505\" width=\"84\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"514\" class=\"dg-lbl-accent\" text-anchor=\"middle\">streamed speech</text></g><g data-step=\"13\"><path id=\"iced-m12\" class=\"dg-e\" d=\"M104,560 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"200\" y=\"545\" width=\"168\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"284\" y=\"554\" class=\"dg-lbl\" text-anchor=\"middle\">barge-in: stop, listen again</text></g></svg>"
     },
     "fx": {
      "highlight": [
       {
        "target": "ears",
        "at": 2.41,
        "hold": 1.6
       }
      ]
     },
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "diagram",
     "duration": 14,
     "params": {
      "src": "assets/seq-icedliquid-turn.svg",
      "packets": [
       {
        "path": "iced-m4",
        "at": 1.2,
        "label": "think",
        "arrive": "brain",
        "loop": false
       }
      ],
      "layout": "full",
      "_svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 632\" width=\"1120\" height=\"632\" role=\"img\" aria-labelledby=\"iced-title iced-desc\" class=\"dg-svg\" data-diagram=\"iced\"><title id=\"iced-title\">icedLiquid: one voice turn with a tool call, all models in the tab</title><desc id=\"iced-desc\">icedLiquid hears through the browser WebGPU ASR lane (voice_agent.asr_lane), checks the config phrase lists, thinks on the in-tab LFM3-Omni brain with tool specs, calls /api/agent-tools/&lt;name&gt; on the Next.js server and draws a card, then speaks the answer as streamed speech. Speaking over the answer (barge-in) stops it and the agent listens again.</desc><style>.dg-bg{fill:var(--brand-color-paper,#f9fafd)}\n.dg-mask{fill:var(--brand-color-paper,#f9fafd)}\n.dg-node{fill:#ffffff;stroke:var(--brand-color-fg,#121a2b);stroke-width:1}\n.dg-focal{fill:rgba(10,93,254,0.08);stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.2}\n.dg-store{fill:rgba(18,26,43,0.05);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1}\n.dg-ext{fill:rgba(18,26,43,0.03);stroke:rgba(18,26,43,0.30);stroke-width:1}\n.dg-e{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1.2}\n.dg-e-link{fill:none;stroke:#1046c1;stroke-width:1.2}\n.dg-e-ret{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1;stroke-dasharray:4 3}\n.dg-e-accent{fill:none;stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.4}\n.dg-life{fill:none;stroke:rgba(18,26,43,0.20);stroke-width:1;stroke-dasharray:3 3}\n.dg-act{fill:rgba(18,26,43,0.06);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:0.8}\n.dg-frame{fill:rgba(18,26,43,0.02);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-tab{fill:var(--brand-color-paper,#f9fafd);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-head{fill:var(--brand-color-fg-secondary,#475061)}\n.dg-head-link{fill:#1046c1}\n.dg-head-accent{fill:var(--brand-color-primary,#0a5dfe)}\n.dg-name{fill:var(--brand-color-fg,#121a2b);font-family:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;font-size:12px;font-weight:600}\n.dg-sub{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:9px}\n.dg-lbl{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em}\n.dg-lbl-accent{fill:var(--brand-color-primary,#0a5dfe);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em;font-weight:500}\n.dg-op{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.12em}</style><defs><marker id=\"iced-arrow\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-link\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-link\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-accent\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-accent\" points=\"0 0, 8 3, 0 6\"/></marker></defs><rect class=\"dg-bg\" x=\"0\" y=\"0\" width=\"1120\" height=\"632\"/><g data-step=\"1\"><path id=\"iced-life-you\" class=\"dg-life\" d=\"M100,96 V612\"/><path id=\"iced-life-ears\" class=\"dg-life\" d=\"M284,96 V612\"/><path id=\"iced-life-agent\" class=\"dg-life\" d=\"M468,96 V612\"/><path id=\"iced-life-brain\" class=\"dg-life\" d=\"M652,96 V612\"/><path id=\"iced-life-tools\" class=\"dg-life\" d=\"M836,96 V612\"/><path id=\"iced-life-voice\" class=\"dg-life\" d=\"M1020,96 V612\"/><rect x=\"96\" y=\"128\" width=\"8\" height=\"24\" class=\"dg-act\"/><rect x=\"280\" y=\"128\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"464\" y=\"160\" width=\"8\" height=\"416\" class=\"dg-act\"/><rect x=\"648\" y=\"240\" width=\"8\" height=\"232\" class=\"dg-act\"/><rect x=\"832\" y=\"336\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"1016\" y=\"480\" width=\"8\" height=\"56\" class=\"dg-act\"/><g data-hit=\"you\" id=\"iced-a-you\"><rect x=\"24\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-node\"/><text x=\"100\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">You</text><text x=\"100\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">mic + speaker</text></g><g data-hit=\"ears\" id=\"iced-a-ears\"><rect x=\"208\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"284\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Ears</text><text x=\"284\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">asr_lane: browser</text></g><g data-hit=\"agent\" id=\"iced-a-agent\"><rect x=\"392\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-focal\"/><text x=\"468\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">icedLiquid agent</text><text x=\"468\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">turns · phrase lists</text></g><g data-hit=\"brain\" id=\"iced-a-brain\"><rect x=\"576\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"652\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Brain</text><text x=\"652\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">LFM3-Omni · WebGPU</text></g><g data-hit=\"tools\" id=\"iced-a-tools\"><rect x=\"760\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-ext\"/><text x=\"836\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Agent tools</text><text x=\"836\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">Next.js server</text></g><g data-hit=\"voice\" id=\"iced-a-voice\"><rect x=\"944\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"1020\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Voice</text><text x=\"1020\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">speech codec · WebGPU</text></g></g><g data-step=\"2\"><path id=\"iced-m1\" class=\"dg-e\" d=\"M104,136 H280\" marker-end=\"url(#iced-arrow)\"/><rect x=\"142\" y=\"121\" width=\"100\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"192\" y=\"130\" class=\"dg-lbl\" text-anchor=\"middle\">speech (VAD start)</text></g><g data-step=\"3\"><path id=\"iced-m2\" class=\"dg-e-ret\" d=\"M288,168 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"332\" y=\"153\" width=\"88\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"376\" y=\"162\" class=\"dg-lbl\" text-anchor=\"middle\">final transcript</text></g><g data-step=\"4\"><path id=\"iced-m3\" class=\"dg-e\" d=\"M472,200 H504 Q512,200 512,208 V212 Q512,220 504,220 H476\" marker-end=\"url(#iced-arrow)\"/><text x=\"520\" y=\"213\" class=\"dg-lbl\" text-anchor=\"start\">phrase lists: theme · goodbye · language</text></g><g data-step=\"5\"><path id=\"iced-m4\" class=\"dg-e\" d=\"M472,248 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"490\" y=\"233\" width=\"140\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"242\" class=\"dg-lbl\" text-anchor=\"middle\">think(history, tool specs)</text></g><g data-step=\"6\"><rect x=\"444\" y=\"268\" width=\"420\" height=\"160\" rx=\"4\" class=\"dg-frame\"/><rect x=\"444\" y=\"268\" width=\"40\" height=\"16\" rx=\"2\" class=\"dg-tab\"/><text x=\"464\" y=\"280\" class=\"dg-op\" text-anchor=\"middle\">LOOP</text><rect x=\"492\" y=\"271\" width=\"180\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"496\" y=\"280\" class=\"dg-lbl\" text-anchor=\"start\">[up to voice_agent.max_tool_rounds]</text><path id=\"iced-m5\" class=\"dg-e-ret\" d=\"M648,312 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"530\" y=\"297\" width=\"60\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"306\" class=\"dg-lbl\" text-anchor=\"middle\">tool_calls</text></g><g data-step=\"7\"><path id=\"iced-m6\" class=\"dg-e-link\" d=\"M472,344 H832\" marker-end=\"url(#iced-arrow-link)\"/><rect x=\"580\" y=\"329\" width=\"160\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"338\" class=\"dg-lbl\" text-anchor=\"middle\">POST /api/agent-tools/&lt;name&gt;</text></g><g data-step=\"8\"><path id=\"iced-m7\" class=\"dg-e-ret\" d=\"M832,376 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"596\" y=\"361\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"370\" class=\"dg-lbl\" text-anchor=\"middle\">{ok, data} · draw card</text></g><g data-step=\"9\"><path id=\"iced-m8\" class=\"dg-e\" d=\"M472,408 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"528\" y=\"393\" width=\"64\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"402\" class=\"dg-lbl\" text-anchor=\"middle\">tool result</text></g><g data-step=\"10\"><path id=\"iced-m9\" class=\"dg-e-ret\" d=\"M648,456 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"496\" y=\"441\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"450\" class=\"dg-lbl\" text-anchor=\"middle\">answer · grounding guard</text></g><g data-step=\"11\"><path id=\"iced-m10\" class=\"dg-e\" d=\"M472,488 H1016\" marker-end=\"url(#iced-arrow)\"/><rect x=\"706\" y=\"473\" width=\"76\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"482\" class=\"dg-lbl\" text-anchor=\"middle\">speak(answer)</text></g><g data-step=\"12\"><path id=\"iced-m11\" class=\"dg-e-accent\" d=\"M1016,520 H104\" marker-end=\"url(#iced-arrow-accent)\"/><rect x=\"702\" y=\"505\" width=\"84\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"514\" class=\"dg-lbl-accent\" text-anchor=\"middle\">streamed speech</text></g><g data-step=\"13\"><path id=\"iced-m12\" class=\"dg-e\" d=\"M104,560 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"200\" y=\"545\" width=\"168\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"284\" y=\"554\" class=\"dg-lbl\" text-anchor=\"middle\">barge-in: stop, listen again</text></g></svg>"
     },
     "fx": {
      "highlight": [
       {
        "target": "brain",
        "at": 3.8,
        "hold": 1.6
       }
      ]
     },
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "diagram",
     "duration": 14,
     "params": {
      "src": "assets/seq-icedliquid-turn.svg",
      "packets": [
       {
        "path": "iced-m6",
        "at": 1,
        "label": "tool",
        "arrive": "tools",
        "loop": false
       },
       {
        "path": "iced-m7",
        "at": 2.4,
        "label": "data",
        "arrive": "agent",
        "loop": false
       }
      ],
      "layout": "full",
      "_svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 632\" width=\"1120\" height=\"632\" role=\"img\" aria-labelledby=\"iced-title iced-desc\" class=\"dg-svg\" data-diagram=\"iced\"><title id=\"iced-title\">icedLiquid: one voice turn with a tool call, all models in the tab</title><desc id=\"iced-desc\">icedLiquid hears through the browser WebGPU ASR lane (voice_agent.asr_lane), checks the config phrase lists, thinks on the in-tab LFM3-Omni brain with tool specs, calls /api/agent-tools/&lt;name&gt; on the Next.js server and draws a card, then speaks the answer as streamed speech. Speaking over the answer (barge-in) stops it and the agent listens again.</desc><style>.dg-bg{fill:var(--brand-color-paper,#f9fafd)}\n.dg-mask{fill:var(--brand-color-paper,#f9fafd)}\n.dg-node{fill:#ffffff;stroke:var(--brand-color-fg,#121a2b);stroke-width:1}\n.dg-focal{fill:rgba(10,93,254,0.08);stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.2}\n.dg-store{fill:rgba(18,26,43,0.05);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1}\n.dg-ext{fill:rgba(18,26,43,0.03);stroke:rgba(18,26,43,0.30);stroke-width:1}\n.dg-e{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1.2}\n.dg-e-link{fill:none;stroke:#1046c1;stroke-width:1.2}\n.dg-e-ret{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1;stroke-dasharray:4 3}\n.dg-e-accent{fill:none;stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.4}\n.dg-life{fill:none;stroke:rgba(18,26,43,0.20);stroke-width:1;stroke-dasharray:3 3}\n.dg-act{fill:rgba(18,26,43,0.06);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:0.8}\n.dg-frame{fill:rgba(18,26,43,0.02);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-tab{fill:var(--brand-color-paper,#f9fafd);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-head{fill:var(--brand-color-fg-secondary,#475061)}\n.dg-head-link{fill:#1046c1}\n.dg-head-accent{fill:var(--brand-color-primary,#0a5dfe)}\n.dg-name{fill:var(--brand-color-fg,#121a2b);font-family:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;font-size:12px;font-weight:600}\n.dg-sub{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:9px}\n.dg-lbl{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em}\n.dg-lbl-accent{fill:var(--brand-color-primary,#0a5dfe);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em;font-weight:500}\n.dg-op{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.12em}</style><defs><marker id=\"iced-arrow\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-link\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-link\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-accent\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-accent\" points=\"0 0, 8 3, 0 6\"/></marker></defs><rect class=\"dg-bg\" x=\"0\" y=\"0\" width=\"1120\" height=\"632\"/><g data-step=\"1\"><path id=\"iced-life-you\" class=\"dg-life\" d=\"M100,96 V612\"/><path id=\"iced-life-ears\" class=\"dg-life\" d=\"M284,96 V612\"/><path id=\"iced-life-agent\" class=\"dg-life\" d=\"M468,96 V612\"/><path id=\"iced-life-brain\" class=\"dg-life\" d=\"M652,96 V612\"/><path id=\"iced-life-tools\" class=\"dg-life\" d=\"M836,96 V612\"/><path id=\"iced-life-voice\" class=\"dg-life\" d=\"M1020,96 V612\"/><rect x=\"96\" y=\"128\" width=\"8\" height=\"24\" class=\"dg-act\"/><rect x=\"280\" y=\"128\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"464\" y=\"160\" width=\"8\" height=\"416\" class=\"dg-act\"/><rect x=\"648\" y=\"240\" width=\"8\" height=\"232\" class=\"dg-act\"/><rect x=\"832\" y=\"336\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"1016\" y=\"480\" width=\"8\" height=\"56\" class=\"dg-act\"/><g data-hit=\"you\" id=\"iced-a-you\"><rect x=\"24\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-node\"/><text x=\"100\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">You</text><text x=\"100\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">mic + speaker</text></g><g data-hit=\"ears\" id=\"iced-a-ears\"><rect x=\"208\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"284\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Ears</text><text x=\"284\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">asr_lane: browser</text></g><g data-hit=\"agent\" id=\"iced-a-agent\"><rect x=\"392\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-focal\"/><text x=\"468\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">icedLiquid agent</text><text x=\"468\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">turns · phrase lists</text></g><g data-hit=\"brain\" id=\"iced-a-brain\"><rect x=\"576\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"652\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Brain</text><text x=\"652\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">LFM3-Omni · WebGPU</text></g><g data-hit=\"tools\" id=\"iced-a-tools\"><rect x=\"760\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-ext\"/><text x=\"836\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Agent tools</text><text x=\"836\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">Next.js server</text></g><g data-hit=\"voice\" id=\"iced-a-voice\"><rect x=\"944\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"1020\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Voice</text><text x=\"1020\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">speech codec · WebGPU</text></g></g><g data-step=\"2\"><path id=\"iced-m1\" class=\"dg-e\" d=\"M104,136 H280\" marker-end=\"url(#iced-arrow)\"/><rect x=\"142\" y=\"121\" width=\"100\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"192\" y=\"130\" class=\"dg-lbl\" text-anchor=\"middle\">speech (VAD start)</text></g><g data-step=\"3\"><path id=\"iced-m2\" class=\"dg-e-ret\" d=\"M288,168 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"332\" y=\"153\" width=\"88\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"376\" y=\"162\" class=\"dg-lbl\" text-anchor=\"middle\">final transcript</text></g><g data-step=\"4\"><path id=\"iced-m3\" class=\"dg-e\" d=\"M472,200 H504 Q512,200 512,208 V212 Q512,220 504,220 H476\" marker-end=\"url(#iced-arrow)\"/><text x=\"520\" y=\"213\" class=\"dg-lbl\" text-anchor=\"start\">phrase lists: theme · goodbye · language</text></g><g data-step=\"5\"><path id=\"iced-m4\" class=\"dg-e\" d=\"M472,248 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"490\" y=\"233\" width=\"140\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"242\" class=\"dg-lbl\" text-anchor=\"middle\">think(history, tool specs)</text></g><g data-step=\"6\"><rect x=\"444\" y=\"268\" width=\"420\" height=\"160\" rx=\"4\" class=\"dg-frame\"/><rect x=\"444\" y=\"268\" width=\"40\" height=\"16\" rx=\"2\" class=\"dg-tab\"/><text x=\"464\" y=\"280\" class=\"dg-op\" text-anchor=\"middle\">LOOP</text><rect x=\"492\" y=\"271\" width=\"180\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"496\" y=\"280\" class=\"dg-lbl\" text-anchor=\"start\">[up to voice_agent.max_tool_rounds]</text><path id=\"iced-m5\" class=\"dg-e-ret\" d=\"M648,312 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"530\" y=\"297\" width=\"60\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"306\" class=\"dg-lbl\" text-anchor=\"middle\">tool_calls</text></g><g data-step=\"7\"><path id=\"iced-m6\" class=\"dg-e-link\" d=\"M472,344 H832\" marker-end=\"url(#iced-arrow-link)\"/><rect x=\"580\" y=\"329\" width=\"160\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"338\" class=\"dg-lbl\" text-anchor=\"middle\">POST /api/agent-tools/&lt;name&gt;</text></g><g data-step=\"8\"><path id=\"iced-m7\" class=\"dg-e-ret\" d=\"M832,376 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"596\" y=\"361\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"370\" class=\"dg-lbl\" text-anchor=\"middle\">{ok, data} · draw card</text></g><g data-step=\"9\"><path id=\"iced-m8\" class=\"dg-e\" d=\"M472,408 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"528\" y=\"393\" width=\"64\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"402\" class=\"dg-lbl\" text-anchor=\"middle\">tool result</text></g><g data-step=\"10\"><path id=\"iced-m9\" class=\"dg-e-ret\" d=\"M648,456 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"496\" y=\"441\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"450\" class=\"dg-lbl\" text-anchor=\"middle\">answer · grounding guard</text></g><g data-step=\"11\"><path id=\"iced-m10\" class=\"dg-e\" d=\"M472,488 H1016\" marker-end=\"url(#iced-arrow)\"/><rect x=\"706\" y=\"473\" width=\"76\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"482\" class=\"dg-lbl\" text-anchor=\"middle\">speak(answer)</text></g><g data-step=\"12\"><path id=\"iced-m11\" class=\"dg-e-accent\" d=\"M1016,520 H104\" marker-end=\"url(#iced-arrow-accent)\"/><rect x=\"702\" y=\"505\" width=\"84\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"514\" class=\"dg-lbl-accent\" text-anchor=\"middle\">streamed speech</text></g><g data-step=\"13\"><path id=\"iced-m12\" class=\"dg-e\" d=\"M104,560 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"200\" y=\"545\" width=\"168\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"284\" y=\"554\" class=\"dg-lbl\" text-anchor=\"middle\">barge-in: stop, listen again</text></g></svg>"
     },
     "fx": {
      "highlight": [
       {
        "target": "tools",
        "at": 0.58,
        "hold": 1.6
       }
      ]
     },
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "diagram",
     "duration": 14,
     "params": {
      "src": "assets/seq-icedliquid-turn.svg",
      "packets": [
       {
        "path": "iced-m11",
        "at": 1.2,
        "label": "speech",
        "arrive": "you",
        "loop": false
       }
      ],
      "layout": "full",
      "_svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 632\" width=\"1120\" height=\"632\" role=\"img\" aria-labelledby=\"iced-title iced-desc\" class=\"dg-svg\" data-diagram=\"iced\"><title id=\"iced-title\">icedLiquid: one voice turn with a tool call, all models in the tab</title><desc id=\"iced-desc\">icedLiquid hears through the browser WebGPU ASR lane (voice_agent.asr_lane), checks the config phrase lists, thinks on the in-tab LFM3-Omni brain with tool specs, calls /api/agent-tools/&lt;name&gt; on the Next.js server and draws a card, then speaks the answer as streamed speech. Speaking over the answer (barge-in) stops it and the agent listens again.</desc><style>.dg-bg{fill:var(--brand-color-paper,#f9fafd)}\n.dg-mask{fill:var(--brand-color-paper,#f9fafd)}\n.dg-node{fill:#ffffff;stroke:var(--brand-color-fg,#121a2b);stroke-width:1}\n.dg-focal{fill:rgba(10,93,254,0.08);stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.2}\n.dg-store{fill:rgba(18,26,43,0.05);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1}\n.dg-ext{fill:rgba(18,26,43,0.03);stroke:rgba(18,26,43,0.30);stroke-width:1}\n.dg-e{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1.2}\n.dg-e-link{fill:none;stroke:#1046c1;stroke-width:1.2}\n.dg-e-ret{fill:none;stroke:var(--brand-color-fg-secondary,#475061);stroke-width:1;stroke-dasharray:4 3}\n.dg-e-accent{fill:none;stroke:var(--brand-color-primary,#0a5dfe);stroke-width:1.4}\n.dg-life{fill:none;stroke:rgba(18,26,43,0.20);stroke-width:1;stroke-dasharray:3 3}\n.dg-act{fill:rgba(18,26,43,0.06);stroke:var(--brand-color-fg-secondary,#475061);stroke-width:0.8}\n.dg-frame{fill:rgba(18,26,43,0.02);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-tab{fill:var(--brand-color-paper,#f9fafd);stroke:rgba(18,26,43,0.22);stroke-width:1}\n.dg-head{fill:var(--brand-color-fg-secondary,#475061)}\n.dg-head-link{fill:#1046c1}\n.dg-head-accent{fill:var(--brand-color-primary,#0a5dfe)}\n.dg-name{fill:var(--brand-color-fg,#121a2b);font-family:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;font-size:12px;font-weight:600}\n.dg-sub{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:9px}\n.dg-lbl{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em}\n.dg-lbl-accent{fill:var(--brand-color-primary,#0a5dfe);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.04em;font-weight:500}\n.dg-op{fill:var(--brand-color-fg-secondary,#475061);font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;font-size:8px;letter-spacing:0.12em}</style><defs><marker id=\"iced-arrow\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-link\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-link\" points=\"0 0, 8 3, 0 6\"/></marker><marker id=\"iced-arrow-accent\" markerWidth=\"8\" markerHeight=\"6\" refX=\"7\" refY=\"3\" orient=\"auto\" markerUnits=\"userSpaceOnUse\"><polygon class=\"dg-head-accent\" points=\"0 0, 8 3, 0 6\"/></marker></defs><rect class=\"dg-bg\" x=\"0\" y=\"0\" width=\"1120\" height=\"632\"/><g data-step=\"1\"><path id=\"iced-life-you\" class=\"dg-life\" d=\"M100,96 V612\"/><path id=\"iced-life-ears\" class=\"dg-life\" d=\"M284,96 V612\"/><path id=\"iced-life-agent\" class=\"dg-life\" d=\"M468,96 V612\"/><path id=\"iced-life-brain\" class=\"dg-life\" d=\"M652,96 V612\"/><path id=\"iced-life-tools\" class=\"dg-life\" d=\"M836,96 V612\"/><path id=\"iced-life-voice\" class=\"dg-life\" d=\"M1020,96 V612\"/><rect x=\"96\" y=\"128\" width=\"8\" height=\"24\" class=\"dg-act\"/><rect x=\"280\" y=\"128\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"464\" y=\"160\" width=\"8\" height=\"416\" class=\"dg-act\"/><rect x=\"648\" y=\"240\" width=\"8\" height=\"232\" class=\"dg-act\"/><rect x=\"832\" y=\"336\" width=\"8\" height=\"56\" class=\"dg-act\"/><rect x=\"1016\" y=\"480\" width=\"8\" height=\"56\" class=\"dg-act\"/><g data-hit=\"you\" id=\"iced-a-you\"><rect x=\"24\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-node\"/><text x=\"100\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">You</text><text x=\"100\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">mic + speaker</text></g><g data-hit=\"ears\" id=\"iced-a-ears\"><rect x=\"208\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"284\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Ears</text><text x=\"284\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">asr_lane: browser</text></g><g data-hit=\"agent\" id=\"iced-a-agent\"><rect x=\"392\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-focal\"/><text x=\"468\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">icedLiquid agent</text><text x=\"468\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">turns · phrase lists</text></g><g data-hit=\"brain\" id=\"iced-a-brain\"><rect x=\"576\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"652\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Brain</text><text x=\"652\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">LFM3-Omni · WebGPU</text></g><g data-hit=\"tools\" id=\"iced-a-tools\"><rect x=\"760\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-ext\"/><text x=\"836\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Agent tools</text><text x=\"836\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">Next.js server</text></g><g data-hit=\"voice\" id=\"iced-a-voice\"><rect x=\"944\" y=\"48\" width=\"152\" height=\"48\" rx=\"6\" class=\"dg-store\"/><text x=\"1020\" y=\"68\" class=\"dg-name\" text-anchor=\"middle\">Voice</text><text x=\"1020\" y=\"83\" class=\"dg-sub\" text-anchor=\"middle\">speech codec · WebGPU</text></g></g><g data-step=\"2\"><path id=\"iced-m1\" class=\"dg-e\" d=\"M104,136 H280\" marker-end=\"url(#iced-arrow)\"/><rect x=\"142\" y=\"121\" width=\"100\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"192\" y=\"130\" class=\"dg-lbl\" text-anchor=\"middle\">speech (VAD start)</text></g><g data-step=\"3\"><path id=\"iced-m2\" class=\"dg-e-ret\" d=\"M288,168 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"332\" y=\"153\" width=\"88\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"376\" y=\"162\" class=\"dg-lbl\" text-anchor=\"middle\">final transcript</text></g><g data-step=\"4\"><path id=\"iced-m3\" class=\"dg-e\" d=\"M472,200 H504 Q512,200 512,208 V212 Q512,220 504,220 H476\" marker-end=\"url(#iced-arrow)\"/><text x=\"520\" y=\"213\" class=\"dg-lbl\" text-anchor=\"start\">phrase lists: theme · goodbye · language</text></g><g data-step=\"5\"><path id=\"iced-m4\" class=\"dg-e\" d=\"M472,248 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"490\" y=\"233\" width=\"140\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"242\" class=\"dg-lbl\" text-anchor=\"middle\">think(history, tool specs)</text></g><g data-step=\"6\"><rect x=\"444\" y=\"268\" width=\"420\" height=\"160\" rx=\"4\" class=\"dg-frame\"/><rect x=\"444\" y=\"268\" width=\"40\" height=\"16\" rx=\"2\" class=\"dg-tab\"/><text x=\"464\" y=\"280\" class=\"dg-op\" text-anchor=\"middle\">LOOP</text><rect x=\"492\" y=\"271\" width=\"180\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"496\" y=\"280\" class=\"dg-lbl\" text-anchor=\"start\">[up to voice_agent.max_tool_rounds]</text><path id=\"iced-m5\" class=\"dg-e-ret\" d=\"M648,312 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"530\" y=\"297\" width=\"60\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"306\" class=\"dg-lbl\" text-anchor=\"middle\">tool_calls</text></g><g data-step=\"7\"><path id=\"iced-m6\" class=\"dg-e-link\" d=\"M472,344 H832\" marker-end=\"url(#iced-arrow-link)\"/><rect x=\"580\" y=\"329\" width=\"160\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"338\" class=\"dg-lbl\" text-anchor=\"middle\">POST /api/agent-tools/&lt;name&gt;</text></g><g data-step=\"8\"><path id=\"iced-m7\" class=\"dg-e-ret\" d=\"M832,376 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"596\" y=\"361\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"660\" y=\"370\" class=\"dg-lbl\" text-anchor=\"middle\">{ok, data} · draw card</text></g><g data-step=\"9\"><path id=\"iced-m8\" class=\"dg-e\" d=\"M472,408 H648\" marker-end=\"url(#iced-arrow)\"/><rect x=\"528\" y=\"393\" width=\"64\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"402\" class=\"dg-lbl\" text-anchor=\"middle\">tool result</text></g><g data-step=\"10\"><path id=\"iced-m9\" class=\"dg-e-ret\" d=\"M648,456 H472\" marker-end=\"url(#iced-arrow)\"/><rect x=\"496\" y=\"441\" width=\"128\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"560\" y=\"450\" class=\"dg-lbl\" text-anchor=\"middle\">answer · grounding guard</text></g><g data-step=\"11\"><path id=\"iced-m10\" class=\"dg-e\" d=\"M472,488 H1016\" marker-end=\"url(#iced-arrow)\"/><rect x=\"706\" y=\"473\" width=\"76\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"482\" class=\"dg-lbl\" text-anchor=\"middle\">speak(answer)</text></g><g data-step=\"12\"><path id=\"iced-m11\" class=\"dg-e-accent\" d=\"M1016,520 H104\" marker-end=\"url(#iced-arrow-accent)\"/><rect x=\"702\" y=\"505\" width=\"84\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"744\" y=\"514\" class=\"dg-lbl-accent\" text-anchor=\"middle\">streamed speech</text></g><g data-step=\"13\"><path id=\"iced-m12\" class=\"dg-e\" d=\"M104,560 H464\" marker-end=\"url(#iced-arrow)\"/><rect x=\"200\" y=\"545\" width=\"168\" height=\"12\" rx=\"2\" class=\"dg-mask\"/><text x=\"284\" y=\"554\" class=\"dg-lbl\" text-anchor=\"middle\">barge-in: stop, listen again</text></g></svg>"
     },
     "fx": {
      "highlight": [
       {
        "target": "voice",
        "at": 1.03,
        "hold": 3.19
       },
       {
        "target": "you",
        "at": 4.97,
        "hold": 1.6
       }
      ]
     },
     "camera": null,
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "tools",
   "preset": null,
   "duration": 41,
   "label": "Tools and cards",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "ui-tour",
     "duration": 16,
     "params": {
      "src": "assets/voice-agent-light-weather.png",
      "spots": [
       {
        "x": 71.4,
        "y": 22.5,
        "w": 19.9,
        "h": 4.2,
        "label": "Your question",
        "text": "weather in Hamburg",
        "pin": "l"
       },
       {
        "x": 39.7,
        "y": 28.4,
        "w": 40,
        "h": 28,
        "label": "Weather card",
        "text": "drawn from the tool result"
       },
       {
        "x": 39.7,
        "y": 60.6,
        "w": 36,
        "h": 9.2,
        "label": "Spoken answer",
        "text": "built from the same data"
       },
       {
        "x": 39.7,
        "y": 70.2,
        "w": 30.5,
        "h": 2.6,
        "label": "Turn badges",
        "text": "time, context, tokens, rounds"
       }
      ],
      "_aspect": "3200/1800"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "table",
     "duration": 13,
     "params": {
      "kicker": "Single live calls, not a bench",
      "title": "Three tools, server side",
      "columns": [
       {
        "label": "tool"
       },
       {
        "label": "source"
       },
       {
        "label": "live call · ms",
        "numeric": true
       }
      ],
      "rows": [
       [
        "get_weather Hamburg",
        "WeatherAPI forecast",
        "212"
       ],
       [
        "get_time Tokyo",
        "Intl + WeatherAPI time zone",
        "128"
       ],
       [
        "web_search",
        "Exa, 3 pages",
        "3170"
       ]
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "row-1",
        "at": 3.37,
        "hold": 2.27
       },
       {
        "target": "row-2",
        "at": 6.39,
        "hold": 2.38
       },
       {
        "target": "row-3",
        "at": 9.52,
        "hold": 1.6
       }
      ]
     },
     "camera": "pan",
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 12,
     "params": {
      "kicker": "Cards",
      "title": "Hear the short version, read the long one",
      "cards": [
       {
        "title": "Weather",
        "text": "forecast card beside the answer",
        "icon": "activity"
       },
       {
        "title": "Web search",
        "text": "3 source cards",
        "icon": "file-text"
       },
       {
        "title": "Time",
        "text": "get_time, IANA time zone",
        "icon": "calendar-days"
       },
       {
        "title": "Images",
        "text": "configured, not used in this session",
        "icon": "sparkles"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-2",
        "at": 2.2,
        "hold": 1.28
       },
       {
        "target": "card-4",
        "at": 4.23,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "bargein",
   "preset": null,
   "duration": 64,
   "label": "Barge-in, phrases and the stage",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "table",
     "duration": 12,
     "params": {
      "kicker": "Config, voice_agent",
      "title": "Speak over it to stop it",
      "columns": [
       {
        "label": "knob"
       },
       {
        "label": "value"
       }
      ],
      "rows": [
       [
        "barge-in enabled",
        "true"
       ],
       [
        "mic level that counts as you",
        "-35 dBFS"
       ],
       [
        "level must hold · milliseconds",
        "300"
       ],
       [
        "echo margin over playback",
        "-8 decibels"
       ],
       [
        "mic closed after the answer · milliseconds",
        "600"
       ]
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "row-1",
        "at": 1.28,
        "hold": 1.58
       },
       {
        "target": "row-3",
        "at": 3.61,
        "hold": 2.62
       },
       {
        "target": "row-4",
        "at": 6.98,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "split-compare",
     "duration": 12,
     "params": {
      "mid": "or",
      "kicker": "Turn taking",
      "title": "Phrases beat a skipped tool call",
      "a": {
       "title": "Model tool call",
       "points": [
        "set_theme, end_session",
        "a small model may skip it"
       ]
      },
      "b": {
       "title": "Phrase lists",
       "points": [
        "dark mode, goodbye, speak French",
        "matched in code every time"
       ]
      }
     },
     "fx": {
      "highlight": [
       {
        "target": "b",
        "at": 3.61,
        "hold": 2.61
       },
       {
        "target": "a",
        "at": 6.97,
        "hold": 1.6
       }
      ]
     },
     "camera": "pan",
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 12,
     "params": {
      "kicker": "Read it right",
      "title": "Configured, not measured",
      "cards": [
       {
        "title": "Barge-in",
        "text": "no measured interrupt in this run",
        "icon": "shield-check"
       },
       {
        "title": "Speakers",
        "text": "the answer can trigger it; use headphones",
        "icon": "activity"
       },
       {
        "title": "Fillers",
        "text": "a lone filler within 2500 milliseconds is dropped",
        "icon": "message-circle-more"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-1",
        "at": 0.45,
        "hold": 2.7
       },
       {
        "target": "card-2",
        "at": 3.9,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "ui-tour",
     "duration": 16,
     "params": {
      "src": "assets/voice-agent-fullscreen-dark.png",
      "spots": [
       {
        "x": 89,
        "y": 2.7,
        "w": 9.5,
        "h": 4.4,
        "label": "Quit full screen",
        "text": "or press Esc",
        "pin": "bl"
       },
       {
        "x": 66.3,
        "y": 11.6,
        "w": 27.7,
        "h": 4.4,
        "label": "Session chips",
        "text": "turns, tokens, rate, context",
        "pin": "l"
       },
       {
        "x": 38.9,
        "y": 16.9,
        "w": 40,
        "h": 28,
        "label": "Weather card",
        "text": "same card, dark theme"
       },
       {
        "x": 38.9,
        "y": 71.6,
        "w": 57.6,
        "h": 10.2,
        "label": "Search card",
        "text": "source cards from the web search"
       }
      ],
      "_aspect": "3200/1800"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "image",
     "duration": 12,
     "params": {
      "src": "assets/voice-agent-mobile-dark.png",
      "frame": "none",
      "layout": "hero",
      "motion": "zoom",
      "kicker": "On a phone",
      "title": "Same tiles, one column",
      "body": "The GPU line wraps instead of cutting off.",
      "caption": "Phone, dark theme: tiles and chips stack in one column"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "session",
   "preset": null,
   "duration": 53,
   "label": "The measured session",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "table",
     "duration": 14,
     "params": {
      "kicker": "Run 20261030T024341Z, one session",
      "title": "Medians over all saved turns",
      "columns": [
       {
        "label": "what"
       },
       {
        "label": "value · ms",
        "numeric": true
       }
      ],
      "rows": [
       [
        "reply, end of question to first audio, p50",
        "1121.1"
       ],
       [
        "reply, p90",
        "2976.0"
       ],
       [
        "ears, final recognition pass, p50",
        "161.1"
       ],
       [
        "brain thinking time, p50",
        "837.9"
       ],
       [
        "speak start to first audio, p50",
        "282.9"
       ]
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "row-1",
        "at": 3.09,
        "hold": 6.6
       },
       {
        "target": "row-2",
        "at": 10.44,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "kpi-trio",
     "duration": 13,
     "params": {
      "kicker": "Rates, p50",
      "title": "Brain, voice, ears",
      "roll": true,
      "tiles": [
       {
        "value": 14.4,
        "decimals": 1,
        "label": "brain, tokens/s p50"
       },
       {
        "value": 24,
        "decimals": 1,
        "label": "voice codec, tokens/s p50"
       },
       {
        "value": 161.1,
        "decimals": 1,
        "label": "final ears pass, ms p50"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "kpi-1",
        "at": 0.8,
        "hold": 3.07
       },
       {
        "target": "kpi-2",
        "at": 4.62,
        "hold": 4.3
       },
       {
        "target": "kpi-3",
        "at": 9.67,
        "hold": 1.6
       }
      ]
     },
     "camera": "pull",
     "transition": null,
     "dark": false
    },
    {
     "preset": "ui-tour",
     "duration": 14,
     "params": {
      "src": "assets/voice-agent-light-weather.png",
      "spots": [
       {
        "x": 5.5,
        "y": 65.6,
        "w": 27,
        "h": 4,
        "label": "Time to answer",
        "text": "end of question to first audio"
       },
       {
        "x": 5.5,
        "y": 70.5,
        "w": 27,
        "h": 9,
        "label": "Stage tiles",
        "text": "milliseconds per stage, this turn"
       },
       {
        "x": 39.7,
        "y": 70.2,
        "w": 30.5,
        "h": 2.6,
        "label": "Turn badges",
        "text": "context, tokens, rate, rounds"
       },
       {
        "x": 64.3,
        "y": 11.6,
        "w": 27.2,
        "h": 4.4,
        "label": "Session chips",
        "text": "totals for the session"
       },
       {
        "x": 92,
        "y": 12.4,
        "w": 2.2,
        "h": 2.6,
        "label": "Save run",
        "text": "exports the session file"
       }
      ],
      "_aspect": "3200/1800"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 12,
     "params": {
      "kicker": "Context",
      "title": "History grew, the brain kept pace",
      "cards": [
       {
        "title": "First turn",
        "text": "1150 context tokens",
        "icon": "file-text"
       },
       {
        "title": "Last turn",
        "text": "1491 context tokens",
        "icon": "file-text"
       },
       {
        "title": "Mixed input",
        "text": "typed questions plus short mic turns",
        "icon": "users-round"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-1",
        "at": 4.08,
        "hold": 1.12
       },
       {
        "target": "card-2",
        "at": 5.95,
        "hold": 3.07
       },
       {
        "target": "card-3",
        "at": 9.77,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "limits",
   "preset": null,
   "duration": 42,
   "label": "Honest limits",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "card-grid",
     "duration": 16,
     "params": {
      "kicker": "In diagnosis",
      "title": "Browser microphone recognition",
      "cards": [
       {
        "title": "Live microphone",
        "text": "text in 0 of 7 passes",
        "icon": "activity"
       },
       {
        "title": "Replay bench",
        "text": "non-empty 1.00 share, open gap",
        "icon": "clipboard-check"
       },
       {
        "title": "Not a win yet",
        "text": "the register row stays an open gap",
        "icon": "shield-check"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-1",
        "at": 4.53,
        "hold": 2.91
       },
       {
        "target": "card-2",
        "at": 8.19,
        "hold": 4.1
       },
       {
        "target": "card-3",
        "at": 13.04,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 14,
     "params": {
      "kicker": "Read it right",
      "title": "One session, mixed input",
      "cards": [
       {
        "title": "Typed questions",
        "text": "the operator was not at the mic",
        "icon": "clipboard-pen-line"
       },
       {
        "title": "Unscripted mic turns",
        "text": "echo or room noise, kept in every median",
        "icon": "message-circle-more"
       },
       {
        "title": "One machine",
        "text": "one Mac, one browser profile, one session",
        "icon": "user-round"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-1",
        "at": 2.42,
        "hold": 0.16
       },
       {
        "target": "card-2",
        "at": 3.33,
        "hold": 5.5
       },
       {
        "target": "card-3",
        "at": 9.58,
        "hold": 1.6
       }
      ]
     },
     "camera": "pan",
     "transition": null,
     "dark": false
    },
    {
     "preset": "card-grid",
     "duration": 12,
     "params": {
      "kicker": "A wrong answer",
      "title": "Tokyo, without a tool",
      "cards": [
       {
        "title": "What happened",
        "text": "the time, answered with no tool call, was wrong",
        "icon": "calendar-days"
       },
       {
        "title": "Why it matters",
        "text": "only a tool call makes an answer checkable",
        "icon": "bot"
       },
       {
        "title": "Config now",
        "text": "grounding guard: retry, then decline; not measured live",
        "icon": "shield-check"
       }
      ]
     },
     "fx": {
      "highlight": [
       {
        "target": "card-1",
        "at": 1.89,
        "hold": 2.71
       },
       {
        "target": "card-2",
        "at": 5.35,
        "hold": 1.08
       },
       {
        "target": "card-3",
        "at": 7.18,
        "hold": 1.6
       }
      ]
     },
     "camera": "push",
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "reproduce",
   "preset": null,
   "duration": 26,
   "label": "Reproduce",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "code",
     "duration": 14,
     "params": {
      "file": "README.md",
      "mode": "type",
      "code": "git clone https://github.com/Dudoxx/icedliquid.git && cd icedliquid\npnpm install\n# once: the browser weights into models/ (git-ignored)\npnpm models:provision\npnpm dev\n# open http://localhost:3400/en/voice-agent, run a session, press Save run"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    },
    {
     "preset": "step-rail",
     "duration": 12,
     "params": {
      "src": "assets/voice-agent-light-idle.png",
      "kicker": "Your run",
      "title": "Then check every number",
      "steps": [
       {
        "title": "Start the web app",
        "text": "pnpm dev",
        "focus": {
         "x": 0,
         "y": 0,
         "w": 100,
         "h": 9
        }
       },
       {
        "title": "Open the assistant",
        "text": "/en/voice-agent",
        "focus": {
         "x": 4,
         "y": 9,
         "w": 31,
         "h": 80
        }
       },
       {
        "title": "Ask three questions",
        "text": "weather, time, web search",
        "focus": {
         "x": 14.5,
         "y": 58,
         "w": 9,
         "h": 7
        }
       },
       {
        "title": "Read the numbers",
        "text": "showcase/article PDF"
       }
      ],
      "_aspect": "3200/1800"
     },
     "fx": null,
     "camera": null,
     "transition": null,
     "dark": false
    }
   ]
  },
  {
   "id": "thanks",
   "preset": null,
   "duration": 26,
   "label": "Thank you, Liquid AI",
   "dark": false,
   "act": null,
   "params": {},
   "transition": null,
   "camera": null,
   "fx": null,
   "background": null,
   "strap": true,
   "beats": [
    {
     "preset": "quote",
     "duration": 14,
     "params": {
      "text": "One model that listens, thinks and speaks, small enough for a browser tab. That is what made icedLiquid possible.",
      "mark": "small enough for a browser tab",
      "who": {
       "name": "Thank you, Liquid AI",
       "role": "https://www.liquid.ai"
      }
     },
     "fx": null,
     "camera": "push",
     "transition": null,
     "dark": false
    },
    {
     "preset": "endcard",
     "duration": 12,
     "params": {
      "cta": "Docs: how-to/VOICE-AGENT.md · Liquid AI: www.liquid.ai",
      "url": "https://www.liquid.ai"
     },
     "fx": null,
     "camera": "pull",
     "transition": null,
     "dark": false
    }
   ]
  }
 ]
};
window.MOTION_POSTER = 21.2;
window.PIECE_SIBLINGS = {};
/* No manuals hub in the public repo: PIECE_HUB stays unset. */
window.PIECE_INDEX = {"open":{"start":0,"dur":48,"beats":[[0,14],[14,12],[26,12],[38,10]]},"agenda":{"start":48,"dur":14,"beats":[[48,14]]},"tab":{"start":62,"dur":38,"beats":[[62,14],[76,12],[88,12]]},"cache":{"start":100,"dur":24,"beats":[[100,12],[112,12]]},"turn":{"start":124,"dur":56,"beats":[[124,14],[138,14],[152,14],[166,14]]},"tools":{"start":180,"dur":41,"beats":[[180,16],[196,13],[209,12]]},"bargein":{"start":221,"dur":64,"beats":[[221,12],[233,12],[245,12],[257,16],[273,12]]},"session":{"start":285,"dur":53,"beats":[[285,14],[299,13],[312,14],[326,12]]},"limits":{"start":338,"dur":42,"beats":[[338,16],[354,14],[368,12]]},"reproduce":{"start":380,"dur":26,"beats":[[380,14],[394,12]]},"thanks":{"start":406,"dur":26,"beats":[[406,14],[420,12]]}};
