import { defineConfig } from "vite";
// @ts-expect-error Node types are not needed by the app source.
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;
export default defineConfig({
  clearScreen: false,
  build: { target: "safari15", cssTarget: "safari15" },
  server: { port: 1420, strictPort: true, host: host || "127.0.0.1", watch: { ignored: ["**/src-tauri/**"] },
    // A loopback-only preview route; never part of the installed application.
    proxy: process.env.SANHAO_LOCAL_MODEL_PREVIEW === '1' ? {
      '/__local-chat': {target:'http://127.0.0.1:1451',rewrite:()=>'/completion'},
    } : undefined,
  },
});
