// src/routes/productos.js
import { Router } from "express";
import mongoose from "mongoose";
import Producto from "../models/Producto.js";
import { requireAuth } from "../middlewares/auth.js";


const router = Router();
router.use(requireAuth);


function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Crear producto
router.post("/", async (req, res) => {
  try {
    const doc = await Producto.create(req.body);
    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err) });
  }
});

// Listar productos
router.get("/", async (_req, res) => {
  try {
    const docs = await Producto.find().limit(100).sort({ createdAt: -1 });
    return res.json({ ok: true, data: docs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Obtener producto por id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const doc = await Producto.findById(id);
    if (!doc) return res.status(404).json({ ok: false, error: "Producto no encontrado" });

    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Actualizar producto por id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const doc = await Producto.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!doc) return res.status(404).json({ ok: false, error: "Producto no encontrado" });

    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err) });
  }
});

// Eliminar producto por id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const doc = await Producto.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ ok: false, error: "Producto no encontrado" });

    return res.json({ ok: true, deletedId: doc._id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
