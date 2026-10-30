<!-- © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# WebGPU in icedLiquid

## What WebGPU is

WebGPU is a web standard that gives a web page access to the computer's
graphics processor (GPU) for drawing and for general computation. icedLiquid
uses it to run a full speech and language model inside the browser tab.

Source: https://www.w3.org/TR/webgpu/

## How icedLiquid uses WebGPU

icedLiquid runs the ONNX graphs of LFM3-Omni-2B with onnxruntime-web on its
WebGPU execution provider. The weights are q4f16: 4-bit weights with 16-bit
floating-point math. The model files load from your own server once and are
then kept in the browser's private file storage (OPFS).

## Browser support

icedLiquid is built and tested for current desktop Chrome and Edge. Browsers
allow WebGPU and the microphone only in a secure context: http://localhost or
HTTPS.
