// src/routes/usuarios.js

import { Router } from "express";
import mongoose from "mongoose";
import Usuario from "../models/Usuario.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";
import AuditLog from "../models/AuditLog.js";

const router = Router();

const ROLES_VALIDOS = ["admin", "supervisor", "cajero", "vendedor"];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.use(requireAuth);

/* =========================
   GET USUARIOS
========================= */

router.get(
  "/",
  requireRole(["admin", "supervisor"]),
  async (req, res) => {
    try {
      const usuarios = await Usuario.find({ activo: true })
        .select("-password")
        .sort({ createdAt: -1 });

      res.json({
        ok: true,
        count: usuarios.length,
        data: usuarios,
      });
    } catch (err) {
      console.error("GET USERS ERROR:", err);
      res.status(500).json({
        ok: false,
        error: "Error al obtener usuarios",
      });
    }
  }
);

/* =========================
   CREAR USUARIO
========================= */

router.post(
  "/",
  requireRole("admin"),
  async (req, res) => {
    try {
      const { nombre, email, password, rol } = req.body;

      const nuevo = new Usuario({
        nombre,
        email,
        password,
        rol,
      });

      await nuevo.save();
      console.log("AUDIT BLOCK REACHED");


      // 📌 Auditoría
      try {
        const ejecutor = await Usuario.findById(req.user.id).select("+email");

        await AuditLog.create({
          usuarioId: ejecutor._id,
          usuarioEmail: ejecutor.email,
          accion: "CREAR_USUARIO",
          entidad: "Usuario",
          entidadId: nuevo._id.toString(),
          metadata: {
            creadoRol: nuevo.rol,
          },
          ip: req.ip,
        });
      } catch (err) {
        console.error("AUDIT CREATE ERROR:", err);
      }

      res.status(201).json({
        ok: true,
        data: {
          id: nuevo._id,
          nombre: nuevo.nombre,
          email: nuevo.email,
          rol: nuevo.rol,
        },
      });
    } catch (err) {
      console.error("CREATE USER ERROR:", err);
      res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
  }
);

/* =========================
   ACTUALIZAR USUARIO
========================= */

router.patch(
  "/:id",
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          ok: false,
          error: "ID inválido",
        });
      }

      const { rol, activo } = req.body;

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          ok: false,
          error: "Usuario no encontrado",
        });
      }

      if (rol) {
        if (!ROLES_VALIDOS.includes(rol)) {
          return res.status(400).json({
            ok: false,
            error: "Rol inválido",
          });
        }
        usuario.rol = rol;
      }

      if (typeof activo === "boolean") {
        usuario.activo = activo;
      }

      await usuario.save();

      res.json({
        ok: true,
        data: {
          id: usuario._id,
          nombre: usuario.nombre,
          rol: usuario.rol,
          activo: usuario.activo,
        },
      });
    } catch (err) {
      console.error("PATCH USER ERROR:", err);
      res.status(500).json({
        ok: false,
        error: "Error al actualizar usuario",
      });
    }
  }
);

/* =========================
   DESACTIVAR USUARIO
========================= */

router.delete(
  "/:id",
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          ok: false,
          error: "ID inválido",
        });
      }

      if (req.user.id === id) {
        return res.status(400).json({
          ok: false,
          error: "No puedes desactivar tu propio usuario",
        });
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          ok: false,
          error: "Usuario no encontrado",
        });
      }

      // 🔐 Bloquear eliminación del último admin activo
      if (usuario.rol === "admin" && usuario.activo) {
        const totalAdminsActivos = await Usuario.countDocuments({
          rol: "admin",
          activo: true,
        });

        if (totalAdminsActivos <= 1) {
          return res.status(403).json({
            ok: false,
            error: "No se puede desactivar el último administrador del sistema",
          });
        }
      }

      usuario.activo = false;
      await usuario.save();

      // 📌 Auditoría
      try {
        const ejecutor = await Usuario.findById(req.user.id).select("+email");

        await AuditLog.create({
          usuarioId: ejecutor._id,
          usuarioEmail: ejecutor.email,
          accion: "DESACTIVAR_USUARIO",
          entidad: "Usuario",
          entidadId: usuario._id.toString(),
          metadata: {
            rol: usuario.rol,
          },
          ip: req.ip,
        });
      } catch (err) {
        console.error("AUDIT DELETE ERROR:", err);
      }

      res.json({
        ok: true,
        message: "Usuario desactivado correctamente",
      });
    } catch (err) {
      console.error("DELETE USER ERROR:", err);
      res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
  }
);

export default router;