// src/routes/auth.js

import {
  Router
} from "express";
import bcrypt from "bcryptjs";
import Usuario from "../models/Usuario.js";
import {
  signToken,
  assertJwtReady
} from "../config/jwt.js";

import {
  requireAuth
} from "../middlewares/auth.js";
import {
  requireRole
} from "../middlewares/roles.js";




const router = Router();

/* =========================
   LOGIN REAL
========================= */

router.post("/login", async (req, res) => {
  try {
    assertJwtReady();

    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email y password son obligatorios",
      });
    }

    const usuario = await Usuario.findOne({
      email
    }).select("+password");

    if (!usuario || !usuario.activo) {
      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    const isMatch = await bcrypt.compare(password, usuario.password);

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
    return res.status(404).json({
      ok: false,
      error: "Not Found"
    });
  }

  try {
    assertJwtReady();

    const token = signToken({
      id: "dev-user",
      rol: "admin",
    });

    return res.json({
      ok: true,
      token
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
});

/* =========================
   REGISTER
========================= */
router.post(
  "/register",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      assertJwtReady();

      const { nombre, email, password, rol } = req.body;

      if (!nombre || !email || !password) {
        return res.status(400).json({
          ok: false,
          error: "Nombre, email y password son obligatorios",
        });
      }

      // Evitar que el admin cree otro usuario con su mismo email
      if (email.toLowerCase() === req.user.email?.toLowerCase()) {
        return res.status(400).json({
          ok: false,
          error: "No puedes registrarte nuevamente con tu propio email",
        });
      }

      const existe = await Usuario.findOne({ email });

      if (existe) {
        return res.status(400).json({
          ok: false,
          error: "El usuario ya existe",
        });
      }

      const nuevoUsuario = new Usuario({
        nombre,
        email,
        password,
        rol: rol || "vendedor",
      });

      await nuevoUsuario.save();

      return res.status(201).json({
        ok: true,
        usuario: {
          id: nuevoUsuario._id,
          nombre: nuevoUsuario.nombre,
          email: nuevoUsuario.email,
          rol: nuevoUsuario.rol,
        },
      });
    } catch (err) {
      console.error("REGISTER ERROR:", err);
      return res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
  }
);






export default router;