// src/routes/auth.js

import {
  Router
} from "express";
import bcrypt from "bcryptjs";
import Usuario from "../models/Usuario.js";
import AuditLog from "../models/AuditLog.js";
import {
  signToken,
  assertJwtReady
} from "../config/jwt.js";

const router = Router();

console.log("🔥 AUTH FILE VERSION: LOGIN_FAIL_AUDIT_V4_IPFIX 🔥");

// Captura IP real detrás de Cloudflare/Render
function getClientIp(req) {
  const cf = req.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = req.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  // Con app.set("trust proxy", 1) esto debería ser la IP real
  const ip = req.ip || "";
  return ip.replace(/^::ffff:/, "");
}

/* =========================
   LOGIN
========================= */

router.post("/login", async (req, res) => {
  try {
    assertJwtReady();

    const {
      email,
      password
    } = req.body;

    // ✅ Validación de tipos (evita 500 por toLowerCase/compare con tipos inválidos)
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email y password deben ser texto",
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email y password son obligatorios",
      });
    }

    const emailNormalizado = email.toLowerCase().trim();

    const usuario = await Usuario.findOne({
      email: emailNormalizado,
    }).select("+password");

    /* =========================
       ❌ USUARIO NO EXISTE
    ========================= */
    if (!usuario) {
      try {
        await AuditLog.create({
          usuarioId: null,
          usuarioEmail: emailNormalizado,
          accion: "LOGIN_FALLIDO",
          entidad: "Usuario",
          entidadId: null,
          metadata: {
            motivo: "USUARIO_NO_EXISTE"
          },
          ip: getClientIp(req),
        });
      } catch (auditErr) {
        console.error("AUDIT ERROR (USER NOT FOUND):", auditErr.message);
      }

      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    /* =========================
       ❌ USUARIO INACTIVO
    ========================= */
    if (!usuario.activo) {
      try {
        await AuditLog.create({
          usuarioId: usuario._id,
          usuarioEmail: usuario.email,
          accion: "LOGIN_FALLIDO",
          entidad: "Usuario",
          entidadId: usuario._id.toString(),
          metadata: {
            motivo: "USUARIO_INACTIVO"
          },
          ip: getClientIp(req),
        });
      } catch (auditErr) {
        console.error("AUDIT ERROR (USER INACTIVE):", auditErr.message);
      }

      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    const isMatch = await bcrypt.compare(password, usuario.password);

    /* =========================
       ❌ PASSWORD INCORRECTO
    ========================= */
    if (!isMatch) {
      try {
        await AuditLog.create({
          usuarioId: usuario._id,
          usuarioEmail: usuario.email,
          accion: "LOGIN_FALLIDO",
          entidad: "Usuario",
          entidadId: usuario._id.toString(),
          metadata: {
            motivo: "PASSWORD_INCORRECTO"
          },
          ip: getClientIp(req),
        });
      } catch (auditErr) {
        console.error("AUDIT ERROR (BAD PASSWORD):", auditErr.message);
      }

      return res.status(400).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    /* =========================
       ✅ LOGIN EXITOSO
    ========================= */
    const token = signToken({
      id: usuario._id.toString(),
      rol: usuario.rol,
      email: usuario.email,
    });

    try {
      await AuditLog.create({
        usuarioId: usuario._id,
        usuarioEmail: usuario.email,
        accion: "LOGIN",
        entidad: "Usuario",
        entidadId: usuario._id.toString(),
        metadata: {
          rol: usuario.rol
        },
        ip: getClientIp(req),
      });
    } catch (auditErr) {
      console.error("AUDIT ERROR (LOGIN SUCCESS):", auditErr.message);
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
    console.error("LOGIN FATAL ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Error en login",
    });
  }
});

export default router;