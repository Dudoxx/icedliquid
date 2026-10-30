<!-- © 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# Contributing to icedLiquid

Thank you for helping. This page says how to set up, what to check before a
pull request, and the few rules the code follows.

icedLiquid is maintained by Walid Boudabbous for Dudoxx UG and Acceleate
Consulting (see [docs/ABOUT.md](docs/ABOUT.md)).

## Set up

Follow [INSTALLATION.md](INSTALLATION.md) steps 1 to 5. You need the model
weights (`pnpm models:provision`) to test the voice agent.

## Before you open a pull request

Run these in the repo root. All must pass.

```bash
pnpm lint          # oxlint, type-aware
pnpm typecheck     # tsc --noEmit
pnpm format:check  # oxfmt (pnpm format fixes it)
pnpm build         # production build
```

Then open `/en/voice-agent` in Chrome or Edge and test the flow you changed,
in light and dark theme.

Keep a pull request to one topic. Say in the description what you changed,
why, and how you tested it.

## Rules the code follows

### Text: four languages in lockstep

- No user-visible English text in a component. Every string comes from the
  message files through next-intl (`t('key')`).
- The message files are `messages/<locale>/{common,voice,brand,realtime}.json`
  for `en`, `de`, `fr` and `es`.
- When you add, rename or remove a key, do it in **all four** locales in the
  same commit. If you cannot translate, write the English text in the other
  locales and say so in the pull request.
- Agent phrases (greetings, language switch words, theme and goodbye phrases)
  live in `config/icedliquid.json`, per locale. See
  [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

### Styling: semantic tokens only

- Use the semantic Tailwind utilities: `bg-background`, `bg-card`,
  `text-foreground`, `text-muted-foreground`, `bg-primary`, `ring-ring` and
  the others in `src/app/globals.css`.
- No raw palette classes (`bg-white`, `text-zinc-700`, `bg-blue-500`), no hex
  or `oklch()` values in components.
- Every change must work in light and dark theme.
- Icons come from `lucide-react` only.
- Brand rules: [docs/BRANDING.md](docs/BRANDING.md).

### Behaviour: fail loudly, never fake

- A missing model file or config value is a visible error, never a silent
  default.
- A tool without its key runs its demo mode, and says so: the result carries
  `mode: "demo"` (or `source: "local-knowledge"`), the card shows a **Demo**
  badge, and the agent tells the user. Demo data is never presented as live.
  See [docs/TOOLS.md](docs/TOOLS.md).
- API keys stay on the server. Never read a key in a client component.

### Files

- New source files start with the copyright line used in the existing files.
- Never commit model weights, `.env.local`, `public/ort/` or `models/`.
- Keep files under 1000 lines and functions under 100 lines.

## Sign your commits (DCO)

By contributing, you certify the
[Developer Certificate of Origin 1.1](https://developercertificate.org/):
you wrote the change, or you have the right to submit it under the Apache
License 2.0.

Add a sign-off line to every commit:

```bash
git commit -s -m "Fix barge-in threshold in dark mode"
```

This adds `Signed-off-by: Your Name <you@example.com>` to the message. Use
your real name.

## License of contributions

Your contribution is licensed under the [Apache License 2.0](LICENSE), as
stated in section 5 of that license.

## Report a bug

Open an issue with:

- browser and version, operating system, GPU (from `chrome://gpu`);
- the page locale (`/en`, `/de`, ...);
- what you did, what you expected, what happened;
- the error lines from the browser console and from the server terminal.

Do not paste API keys or `.env.local` into an issue.
