// src/routes/auth.js

import { Router } from "express";
import Usuario from "../models/Usuario.js";
import { signToken, assertJwtReady } from "../config/jwt.js";

const router = Router();

/* =========================
   LOGIN REAL
========================= */

router.post("/login", async (req, res) => {
  try {
    assertJwtReady();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email y password son obligatorios",
      });
    }

    const usuario = await Usuario.findOne({ email }).select("+password");

    if (!usuario || !usuario.activo) {
      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    const isMatch = await usuario.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    const token = signToken({
      id: usuario._id.toString(),
      rol: usuario.rol,
    });

    return res.json({
      ok: true,
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Error en login",
    });
  }
});

/* =========================
   DEV TOKEN (solo local)
========================= */

router.get("/dev-token", (_req, res) => {
  const env = String(process.env.NODE_ENV || "").trim();
  const isProd = env === "production";

  if (isProd) {
    return res.status(404).json({ ok: false, error: "Not Found" });
  }

  try {
    assertJwtReady();

    const token = signToken({
      id: "dev-user",
      rol: "admin",
    });

    return res.json({ ok: true, token });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
});

export default router;
