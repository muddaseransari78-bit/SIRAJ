import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Phase 20 (performance): split the big libraries into their own files.
// Why: the browser keeps each file in its cache. When you change your own code, visitors do not
// re-download React or Three.js again. The 3D chunk is only loaded on pages that use 3D (they are lazy).
const THREE_LIBS = /node_modules\/(three|@react-three|three-stdlib|troika-[a-z-]+|maath|meshline|camera-controls|detect-gpu|suspend-react|its-fine|react-reconciler|zustand|@use-gesture|tunnel-rat|webgl-sdf-generator|bidi-js|potpack|stats-gl|@monogrid)\//;
const REACT_LIBS = /node_modules\/(react|react-dom|react-router|react-router-dom|@remix-run|scheduler)\//;

function manualChunks(id) {
  if (!id.includes("node_modules")) return undefined;
  if (THREE_LIBS.test(id)) return "vendor-three";
  if (REACT_LIBS.test(id)) return "vendor-react";
  if (/node_modules\/framer-motion\//.test(id)) return "vendor-motion";
  if (/node_modules\/(lucide-react|axios)\//.test(id)) return "vendor-ui";
  return undefined;
}

const config = {
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    // Three.js alone is large; it is lazy-loaded, so a higher warning limit is fine.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: { manualChunks },
    },
  },
};

export default defineConfig(({ command, mode }) => {
  // Warn at BUILD time (not fail: docker compose builds with a localhost address on purpose).
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build" && !(process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL)) {
    console.warn("\n[SIRAJ] WARNING: VITE_API_BASE_URL is not set. The built site will not be able to reach your backend.\n" +
      "         Set it (e.g. https://your-backend.onrender.com/api) in Vercel/Netlify -> Environment variables, then redeploy.\n");
  }
  return config;
});
