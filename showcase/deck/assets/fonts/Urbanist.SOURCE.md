# Urbanist — font provenance (D-016 Dudoxx display face)

- Family: Urbanist (The Urbanist Project Authors, https://github.com/coreyhu/Urbanist)
- Licence: SIL Open Font License 1.1 — see `OFL-Urbanist.txt` beside this file (redistributable; bundled so renderers never fetch fonts over the network).
- Official source: Google Fonts repository
  - https://github.com/google/fonts/raw/main/ofl/urbanist/Urbanist%5Bwght%5D.ttf
  - https://github.com/google/fonts/raw/main/ofl/urbanist/OFL.txt
- Fetched: 2026-10-02. `Urbanist[wght].ttf` sha256 748362d51eb276840e9f0023cd2d98299bf709a95fb3a5ae4ffcb624c638ebb9
- Derived files (where present), generated locally with fontTools (unmodified glyphs):
  - `Urbanist-Variable.ttf` — the upstream `Urbanist[wght].ttf`, renamed only (100–900 wght axis)
  - `Urbanist-{Regular,SemiBold,Bold}.ttf` — static instances, `fonttools varLib.instancer wght=400|600|700 --update-name-table`
  - `urbanist-latin-wght-normal.woff2` — `fonttools ttLib.woff2 compress` of the variable TTF
- Decision record: D-016 "Logo Signal" typography (owner, 2026-10-02) — display face for Dudoxx; Inter (UI) and JetBrains Mono (data) unchanged.
