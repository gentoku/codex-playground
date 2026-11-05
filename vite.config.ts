import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/codex-playground/",
  build: {
    rollupOptions: {
      output: {
        // Keep the 3D engine cached independently of the application and controls.
        manualChunks(id) {
          if (id.includes("/node_modules/three/build/three.core.js"))
            return "three-core";
          if (id.includes("/node_modules/three/")) return "three-renderer";
        },
      },
    },
  },
});
