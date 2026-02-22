// src/server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import usuariosRoutes from "./routes/usuarios.js";
import auditRoutes from "./routes/auditlogs.js";

dotenv.config();

console.log("🔥 SERVER FILE VERSION: 2026-02-22-E 🔥");

const app = express();

/**
 * Trust proxy (Render/Cloudflare) — necesario para req.ip / X-Forwarded-For
 * Debe ir ANTES de middlewares y rutas.
 */
app.set("trust proxy", 1);

app.use(express.json());

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API Fruver funcionando" });
});

/* =========================
   DEBUG
========================= */
app.get("/debug-routes", (_req, res) => {
  res.json({ auditMounted: true });
});

/* =========================
   ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditlogs", auditRoutes);

/* =========================
   START SERVER FIRST
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

/* =========================
   CONNECT MONGO AFTER
========================= */
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI no está definida");
} else {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB conectado"))
    .catch((err) => console.error("Error conectando MongoDB:", err));
}