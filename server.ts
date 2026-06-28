import 'dotenv/config';

// ===== BOOT-TIME ENV DIAGNOSTIC =====
(() => {
  const key = process.env.GEMINI_API_KEY;
  const provider = process.env.AI_PROVIDER;
  const masked = key ? `${key.substring(0, 6)}...${key.substring(Math.max(0, key.length - 4))} (len=${key.length})` : 'NOT_SET';
  console.log(`\n========================================`);
  console.log(`[BOOT] GEMINI_API_KEY = ${masked}`);
  console.log(`[BOOT] AI_PROVIDER    = ${provider || 'NOT_SET'}`);
  console.log(`[BOOT] GEMINI_MODEL   = ${process.env.GEMINI_MODEL || 'gemini-2.5-flash (default)'}`);
  console.log(`========================================\n`);
})();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { connectDB } from "./server/db";
import apiRoutes from "./server/routes";
import { startTelemetrySimulator } from "./server/telemetrySimulator";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to handle JSON payloads up to 10MB
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Initialize DB Connection
  await connectDB();

  // Start live telemetry simulator
  startTelemetrySimulator();

  // Mount API Routes
  app.use("/api", apiRoutes);

  // Vite Dev Server Middleware or Production Asset Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Agriculture Digital Twin server running at http://localhost:${PORT}`);
  });
}

startServer();
