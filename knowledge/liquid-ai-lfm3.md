<!-- © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# Liquid AI and LFM3

## About Liquid AI

Liquid AI is an efficiency-first foundation model company. Its mission is to
build efficient general-purpose AI at every scale. Liquid AI was spun out of
MIT CSAIL by four founders: Ramin Hasani (CEO), Mathias Lechner (CTO),
Alexander Amini (CSO) and Daniela Rus.

Source: https://www.liquid.ai/company

## Liquid Foundation Models

Liquid Foundation Models (LFMs) are built for real-world constraints: they run
on GPUs, CPUs and NPUs, on phones, laptops, cars and other devices, on or off
the cloud. The families cover text, vision, audio, omni, nano and decision
models. Builds exist for llama.cpp, MLX, ONNX, Ollama, vLLM and SGLang.

Source: https://www.liquid.ai/models

## LFM3 family

Liquid AI announced LFM3 on 27 October 2026 as its new generation of Liquid
Foundation Models, built for specialized intelligence. LFM3 brings text,
vision, audio, omni and decision models onto one shared backbone. The first
release has six models of about 2B parameters, all branched from
LFM3-1.7B-Base, which was pre-trained on 22T tokens. The models are open-weight
and available on Hugging Face, the Liquid AI Playground and the Liquid AI API.

Source: https://www.liquid.ai/blog/lfm3

## LFM3 architecture

LFM3 uses a tri-hybrid layer mix: gated short convolutions, sliding-window
attention and global attention. Of its 24 layers, 13 are convolutions, 5 are
sliding-window attention with a 256-token window, and 6 are global attention.
The text model LFM3-1.7B has a 256K-token context window and fits in about
1 GB at 4-bit precision. Every LFM3 model can be fine-tuned on a single GPU.

Source: https://www.liquid.ai/blog/lfm3

## LFM3-Omni-2B

LFM3-Omni-2B is Liquid AI's first omni model. It brings vision, audio and
language together in a single model that can see, listen and talk back: spoken
visual question answering, and audio-visual video understanding. icedLiquid
runs its ONNX edition, LFM3-Omni-2B-ONNX, with the q4f16 precision on WebGPU.

Source: https://huggingface.co/LiquidAI/LFM3-Omni-2B-ONNX

## License

Liquid AI states that every LFM is free to download, run and fine-tune,
including commercially, until a company passes 10 million US dollars in annual
revenue. The LFM3-Omni weights keep their own license (LFM 1.0), named on the
Hugging Face model card.

Source: https://www.liquid.ai/models
