# Vendored third-party library: GSAP

The manual loads its motion library from this folder, not from a CDN, so it
opens from `file://` with no network.

## GSAP 3.15.0

| Field | Value |
|---|---|
| Package | `gsap@3.15.0` from the npm registry (https://www.npmjs.com/package/gsap) |
| Tarball sha512 | `sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A==` |
| License | GreenSock Standard "no charge" license, https://gsap.com/standard-license |
| Upstream | https://github.com/greensock/GSAP |
| Files | `gsap.min.js`, `SplitText.min.js`, `DrawSVGPlugin.min.js`, `MorphSVGPlugin.min.js`, `Flip.min.js`, `CustomEase.min.js`, `MotionPathPlugin.min.js`, `ScrambleTextPlugin.min.js` (UMD builds, copied unchanged from the package `dist/` folder) |

GSAP and all its plugins are free of charge since version 3.13 (2025-04-30).
The license is not MIT. It forbids use in a product that competes with
Webflow's visual animation tools. The package ships no LICENSE file; the
license is the URL in each file header and in the package `package.json`.
The upstream license header in every file is intact.

## File checksums (sha256)

```
92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb  gsap.min.js
419f7027a5f086a12cb7988736d8fdd3a6ed2200229661de25b6628ca7ced344  SplitText.min.js
beb19529f54c1212f1f5117d027be01afda2f363a4926d32aa979bc11140edc1  DrawSVGPlugin.min.js
19c891a412240d8521b13330813d9b551ea5b0f707907c365ffecaf1dfa0f5cf  MorphSVGPlugin.min.js
cbe3ca726350f8d230da38a14ce2384e7772e05a45cee6144dd7fe6dde868c2f  Flip.min.js
466e426a5c60c21c94b15a30a3dffacac9bb39ce8f4e07d071d7d4bb1be43390  CustomEase.min.js
ace44a07c6c179f5347d9b46a152d468e4c9f272ee0d68bf0354e00d60000693  MotionPathPlugin.min.js
a2cfaa7223231459dfde37e9385413ee6df065f18121e946ffdde694f8b11f01  ScrambleTextPlugin.min.js
```

## How to refresh

```sh
npm pack gsap@3.15.0 --ignore-scripts   # in an empty temp folder
tar -xzf gsap-3.15.0.tgz
cp package/dist/{gsap,SplitText,DrawSVGPlugin,MorphSVGPlugin,Flip,CustomEase,MotionPathPlugin,ScrambleTextPlugin}.min.js <this folder>
```

Check the tarball against the registry `integrity` value before you extract
it, then update the checksums above.
