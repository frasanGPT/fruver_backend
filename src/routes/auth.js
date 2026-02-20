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

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email y password son obligatorios",
      });
    }

    const emailNormalizado = email.toLowerCase();

    const usuario = await Usuario.findOne({
      email: emailNormalizado,
    }).select("+password");

    // ❌ Usuario no existe o inactivo
    if (!usuario || !usuario.activo) {
      try {
        const AuditLog = (await import("../models/AuditLog.js")).default;

        await AuditLog.create({
          usuarioId: null,
          usuarioEmail: emailNormalizado,
          accion: "LOGIN_FALLIDO",
          entidad: "Usuario",
          entidadId: null,
          metadata: {
            motivo: !usuario ? "USUARIO_NO_EXISTE" : "USUARIO_INACTIVO",
          },
          ip: req.ip,
        });
      } catch (err) {
        console.error("AUDIT LOGIN FAIL ERROR:", err);
      }

      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    const isMatch = await bcrypt.compare(password, usuario.password);

    // ❌ Password incorrecto
    if (!isMatch) {
      try {
        const AuditLog = (await import("../models/AuditLog.js")).default;

        await AuditLog.create({
          usuarioId: usuario._id,
          usuarioEmail: usuario.email,
          accion: "LOGIN_FALLIDO",
          entidad: "Usuario",
          entidadId: usuario._id.toString(),
          metadata: {
            motivo: "PASSWORD_INCORRECTO",
          },
          ip: req.ip,
        });
      } catch (err) {
        console.error("AUDIT LOGIN FAIL ERROR:", err);
      }

      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    // ✅ LOGIN EXITOSO
    const token = signToken({
      id: usuario._id.toString(),
      rol: usuario.rol,
      email: usuario.email,
    });

    try {
      const AuditLog = (await import("../models/AuditLog.js")).default;

      await AuditLog.create({
        usuarioId: usuario._id,
        usuarioEmail: usuario.email,
        accion: "LOGIN",
        entidad: "Usuario",
        entidadId: usuario._id.toString(),
        metadata: {
          rol: usuario.rol,
        },
        ip: req.ip,
      });
    } catch (err) {
      console.error("AUDIT LOGIN SUCCESS ERROR:", err);
    }

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
    console.error("LOGIN ERROR:", err);
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

      const {
        nombre,
        email,
        password,
        rol
      } = req.body;

      if (!nombre || !email || !password) {
        return res.status(400).json({
          ok: false,
          error: "Nombre, email y password son obligatorios",
        });
      }

      const emailNormalizado = email.toLowerCase();

      // Evitar registro con mismo email del admin autenticado
      if (req.user?.email && emailNormalizado === req.user.email.toLowerCase()) {
        return res.status(400).json({
          ok: false,
          error: "No puedes registrarte nuevamente con tu propio email",
        });
      }

      const existe = await Usuario.findOne({
        email: emailNormalizado
      });

      if (existe) {
        return res.status(400).json({
          ok: false,
          error: "El usuario ya existe",
        });
      }

      // 🔐 Impedir crear más de un admin en el sistema
      if (rol === "admin") {
        const totalAdmins = await Usuario.countDocuments({
          rol: "admin"
        });

        if (totalAdmins >= 1) {
          return res.status(403).json({
            ok: false,
            error: "Ya existe un administrador en el sistema",
          });
        }
      }


      const nuevoUsuario = new Usuario({
        nombre,
        email: emailNormalizado,
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