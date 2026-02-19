// src/routes/usuarios.js

import { Router } from "express";
import mongoose from "mongoose";
import Usuario from "../models/Usuario.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";

const router = Router();

const ROLES_VALIDOS = ["admin", "supervisor", "cajero", "vendedor"];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.use(requireAuth);

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
    } catch {
      res.status(500).json({
        ok: false,
        error: "Error al obtener usuarios",
      });
    }
  }
);

router.post(
  "/",
  requireRole(["admin"]),
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

      res.status(201).json({
        ok: true,
        data: nuevo,
      });
    } catch (err) {
      
      
      res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
  }
);






router.patch(
  "/:id",
  requireRole(["admin"]),
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
    } catch {
      res.status(500).json({
        ok: false,
        error: "Error al actualizar usuario",
      });
    }
  }
);

router.delete(
  "/:id",
  requireRole(["admin"]),
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

      usuario.activo = false;
      await usuario.save();

      res.json({
        ok: true,
        message: "Usuario desactivado correctamente",
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: "Error al desactivar usuario",
      });
    }
  }
);

export default router;
