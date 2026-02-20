// src/server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import usuariosRoutes from "./routes/usuarios.js";
import auditRoutes from "./routes/auditlogs.js";


dotenv.config();

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "API Fruver funcionando",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditlogs", auditRoutes);


app.get("/debug-routes", (_req, res) => {
  res.json({
    auditMounted: true
  });
});



console.log("SERVER FILE VERSION: 2026-02-20-A");



if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI no está definida");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

// 🔥 Conectar primero a Mongo y luego levantar servidor
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB conectado");

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error conectando MongoDB:", err);
    process.exit(1);
  });