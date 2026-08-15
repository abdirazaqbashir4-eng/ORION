import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron main/preload processes and build scripts are plain CommonJS Node scripts.
    "electron/**",
    "scripts/**",
    "release/**",
    // Third-party skill/agent reference bundles (installed via `npx skills add`),
    // not app code.
    ".agents/**",
    // Vendored onnxruntime-web WASM runtime, copied verbatim from
    // node_modules by scripts/copy-onnx-wasm.cjs — not our source.
    "public/ort/**",
  ]),
]);

export default eslintConfig;
