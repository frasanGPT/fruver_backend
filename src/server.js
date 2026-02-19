// src/server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import usuariosRoutes from "./routes/usuarios.js";

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

// Puerto SIEMPRE primero (Render necesita que el servidor escuche inmediatamente)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

// Conexión a Mongo después de levantar el servidor
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI no está definida");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB conectado");
  })
  .catch((err) => {
    console.error("Error conectando MongoDB:", err);
  });
