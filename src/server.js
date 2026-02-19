// src/server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import usuariosRoutes from "./routes/usuarios.js";

dotenv.config();

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "API Fruver funcionando",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB conectado");

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error conectando MongoDB:", err);
    process.exit(1);
  });
