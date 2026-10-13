// Runs before every build. ONLY on Vercel (Vercel sets VERCEL=1) it stops the build with a clear message
// if vercel.json still has the placeholder backend address. Other builds (Docker, Netlify, your PC) are not affected.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.env.VERCEL) {
  const file = fileURLToPath(new URL("../vercel.json", import.meta.url));
  const text = readFileSync(file, "utf8");
  if (text.includes("REPLACE-WITH-YOUR-BACKEND")) {
    console.error("\n[SIRAJ] STOP: frontend/vercel.json still says REPLACE-WITH-YOUR-BACKEND.");
    console.error("        Put your real Render address there (https://YOUR-NAME.onrender.com), push to GitHub, and deploy again.");
    console.error("        Without it the /api address does not reach your backend and nobody could log in.\n");
    process.exit(1);
  }
  const api = process.env.VITE_API_BASE_URL || "";
  if (api && api !== "/api") {
    console.warn(`\n[SIRAJ] WARNING: VITE_API_BASE_URL is "${api}". For Safari/iPhone login set it to exactly /api (then vercel.json passes it to your backend).\n`);
  }
}
