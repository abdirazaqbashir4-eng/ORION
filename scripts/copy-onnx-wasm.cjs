// Copies onnxruntime-web's WASM runtime into public/ort/ so the wake-word
// engine (src/lib/wake-word/openwakeword-engine.ts) can self-host it
// instead of depending on a CDN. Runs automatically on `npm install` —
// re-run manually with `node scripts/copy-onnx-wasm.cjs` if public/ort/
// ever goes missing.
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "node_modules", "onnxruntime-web", "dist");
const dest = path.join(__dirname, "..", "public", "ort");

if (!fs.existsSync(src)) {
  process.exit(0); // onnxruntime-web not installed (e.g. a pruned production install)
}

fs.mkdirSync(dest, { recursive: true });

for (const file of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

console.log("Copied onnxruntime-web WASM runtime to public/ort/");
