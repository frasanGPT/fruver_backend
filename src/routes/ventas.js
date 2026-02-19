// src/routes/ventas.js
import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";

import Venta from "../models/Venta.js";
import Caja from "../models/Caja.js";
import Producto from "../models/Producto.js";

const router = Router();
router.use(requireAuth);

const METODOS = ["efectivo", "transferencia", "qr", "llave", "bono", "debito", "credito"];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * ✅ Fault Injection (PERMANENTE pero sin riesgo)
 * - SOLO si NODE_ENV !== "production"
 * - SOLO si ENABLE_FAULT_INJECTION === "1" (flag explícito)
 * - Y solo si el header correspondiente viene en "1"
 *
 * Headers soportados:
 * - x-fail-after-venta: falla después de crear la venta (antes del $inc a caja)
 * - x-fail-after-caja-inc: falla después del $inc a caja (requiere rollback completo)
 */
const ENABLE_FAULT_INJECTION = String(process.env.ENABLE_FAULT_INJECTION || "").trim() === "1";

function shouldFault(req, headerName) {
  const env = String(process.env.NODE_ENV || "development").trim();
  const isProd = env === "production";
  if (isProd) return false;
  if (!ENABLE_FAULT_INJECTION) return false;
  return req.get(headerName) === "1";
}

/**
 * Normaliza y valida items.
 * Espera input: [{ productoId, cantidad }]
 */
function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: "items es requerido (array no vacío)" };
  }

  const norm = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i] || {};
    const productoId = String(it.productoId || "").trim();
    const cantidad = Number(it.cantidad);

    if (!productoId || !isValidObjectId(productoId)) {
      return { ok: false, error: `items[${i}].productoId inválido` };
    }
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      return { ok: false, error: `items[${i}].cantidad inválida (debe ser > 0)` };
    }

    norm.push({ productoId, cantidad });
  }

  return { ok: true, items: norm };
}

/**
 * Descuenta stock item por item (standalone-safe).
 * Si falla alguno, repone lo que ya se descontó y devuelve error.
 */
async function descontarStock(items) {
  const descontados = []; // [{ productoId, cantidad }]

  for (const it of items) {
    const r = await Producto.updateOne(
      { _id: it.productoId, activo: true, stock: { $gte: it.cantidad } },
      { $inc: { stock: -it.cantidad } }
    );

    if (r.matchedCount === 0) {
      // reponer lo ya descontado
      for (const d of descontados) {
        await Producto.updateOne({ _id: d.productoId }, { $inc: { stock: d.cantidad } });
      }
      return {
        ok: false,
        error: `Stock insuficiente o producto inactivo/no existe: ${it.productoId}`,
      };
    }

    descontados.push({ productoId: it.productoId, cantidad: it.cantidad });
  }

  return { ok: true, descontados };
}

async function reponerStock(descontados) {
  for (const d of descontados || []) {
    await Producto.updateOne({ _id: d.productoId }, { $inc: { stock: d.cantidad } });
  }
}

async function revertirCajaInc({ cajaId, metodo, total }) {
  // Best-effort: solo revierte si la caja sigue abierta.
  // (si se cerró justo después, no forzamos porque afectaría arqueo ya cerrado)
  await Caja.updateOne(
    { _id: cajaId, estado: "abierta" },
    { $inc: { [`totales.${metodo}`]: -Number(total || 0) } }
  );
}

// Crear venta (backend calcula total + descuenta stock + suma totales de caja)
router.post("/", async (req, res) => {
  let ventaCreada = null;
  let descontados = [];

  // Para rollback si ya hicimos $inc
  let cajaIncAplicado = false;
  let cajaIncPayload = null; // { cajaId, metodo, total }

  try {
    const { cajaId, metodo, items: rawItems = [], notas = "" } = req.body;

    if (!cajaId || !isValidObjectId(cajaId)) {
      return res.status(400).json({ ok: false, error: "cajaId inválido" });
    }

    if (!metodo || !METODOS.includes(metodo)) {
      return res.status(400).json({ ok: false, error: "metodo inválido" });
    }

    // Caja debe existir y estar abierta
    const caja = await Caja.findById(cajaId).select("_id estado");
    if (!caja) return res.status(404).json({ ok: false, error: "Caja no encontrada" });
    if (caja.estado !== "abierta") {
      return res.status(400).json({ ok: false, error: "Caja no está abierta" });
    }

    // Validar items
    const norm = normalizeItems(rawItems);
    if (!norm.ok) return res.status(400).json({ ok: false, error: norm.error });
    const items = norm.items;

    // Traer productos para snapshot y cálculo
    const ids = [...new Set(items.map((x) => x.productoId))];
    const productos = await Producto.find({ _id: { $in: ids }, activo: true })
      .select("_id nombre precio stock activo")
      .lean();

    const byId = new Map(productos.map((p) => [String(p._id), p]));

    // Validar existencia/activo
    for (const it of items) {
      if (!byId.has(it.productoId)) {
        return res.status(400).json({
          ok: false,
          error: `Producto no existe o está inactivo: ${it.productoId}`,
        });
      }
    }

    // 1) Descontar stock (atómico por producto; con compensación)
    const ds = await descontarStock(items);
    if (!ds.ok) return res.status(400).json({ ok: false, error: ds.error });
    descontados = ds.descontados;

    // 2) Construir snapshot items + calcular total
    const snapshotItems = [];
    let total = 0;

    for (const it of items) {
      const p = byId.get(it.productoId);
      const precio = Number(p.precio || 0);
      const cantidad = Number(it.cantidad);
      const subtotal = precio * cantidad;

      snapshotItems.push({
        productoId: it.productoId,
        nombre: String(p.nombre || ""),
        precio,
        cantidad,
        subtotal,
      });

      total += subtotal;
    }

    // 3) Crear venta
    ventaCreada = await Venta.create({
      cajaId,
      metodo,
      total,
      items: snapshotItems,
      notas: String(notas || ""),
      estado: "completada",
    });

    // 🔥 Fault injection: falla después de crear venta (antes del $inc a caja)
    if (shouldFault(req, "x-fail-after-venta")) {
      throw new Error("FORCED_FAIL_AFTER_VENTA");
    }

    // 4) Sumar totales a caja (solo si sigue abierta)
    const rCaja = await Caja.updateOne(
      { _id: cajaId, estado: "abierta" },
      { $inc: { [`totales.${metodo}`]: total } }
    );

    if (rCaja.matchedCount === 0) {
      // La caja se cerró en medio: revertir stock + eliminar venta
      await reponerStock(descontados);
      await Venta.deleteOne({ _id: ventaCreada._id });
      return res
        .status(400)
        .json({ ok: false, error: "No se pudo completar: caja ya no está abierta" });
    }

    // Marcamos que el inc ya ocurrió (para rollback si algo falla después)
    cajaIncAplicado = true;
    cajaIncPayload = { cajaId, metodo, total };

    // 🔥 Fault injection: falla después del $inc a caja (requiere rollback completo)
    if (shouldFault(req, "x-fail-after-caja-inc")) {
      throw new Error("FORCED_FAIL_AFTER_CAJA_INC");
    }

    return res.status(201).json({ ok: true, data: ventaCreada });
  } catch (err) {
    // Compensación best-effort (rollback completo si aplica)
    try {
      if (cajaIncAplicado && cajaIncPayload) {
        await revertirCajaInc(cajaIncPayload);
      }
      if (descontados.length) await reponerStock(descontados);
      if (ventaCreada?._id) await Venta.deleteOne({ _id: ventaCreada._id });
    } catch (_) {
      // no-op: evitamos ocultar el error original
    }
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// Anular venta (revierte totales + repone stock) - SOLO si caja está abierta
router.patch("/:id/anular", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, error: "ID inválido" });

    const venta = await Venta.findById(id);
    if (!venta) return res.status(404).json({ ok: false, error: "Venta no encontrada" });

    if (venta.estado === "anulada") {
      return res.status(400).json({ ok: false, error: "La venta ya está anulada" });
    }

    // Caja debe estar abierta
    const caja = await Caja.findById(venta.cajaId).select("_id estado");
    if (!caja) return res.status(404).json({ ok: false, error: "Caja no encontrada" });
    if (caja.estado !== "abierta") {
      return res.status(400).json({ ok: false, error: "No se puede anular: caja cerrada" });
    }

    const metodo = venta.metodo;
    const total = Number(venta.total || 0);

    if (!METODOS.includes(metodo)) {
      return res.status(500).json({ ok: false, error: "Método inválido en DB" });
    }
    if (Number.isNaN(total) || total < 0) {
      return res.status(500).json({ ok: false, error: "Total inválido en DB" });
    }

    // 1) Revertir totales primero (solo si caja sigue abierta)
    const r1 = await Caja.updateOne(
      { _id: venta.cajaId, estado: "abierta" },
      { $inc: { [`totales.${metodo}`]: -total } }
    );
    if (r1.matchedCount === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "No se pudo anular: caja ya no está abierta" });
    }

    // 2) Marcar venta como anulada (atómico contra doble anulación)
    const v2 = await Venta.findOneAndUpdate(
      { _id: venta._id, estado: { $ne: "anulada" } },
      { $set: { estado: "anulada" } },
      { new: true }
    );

    if (!v2) {
      // alguien la anuló antes -> revertimos el inc
      await Caja.updateOne(
        { _id: venta.cajaId, estado: "abierta" },
        { $inc: { [`totales.${metodo}`]: total } }
      );
      return res.status(400).json({ ok: false, error: "La venta ya está anulada" });
    }

    // 3) Reponer stock (best-effort)
    for (const it of v2.items || []) {
      const pid = String(it.productoId || "").trim();
      const qty = Number(it.cantidad || 0);
      if (pid && isValidObjectId(pid) && qty > 0) {
        await Producto.updateOne({ _id: pid }, { $inc: { stock: qty } });
      }
    }

    return res.json({ ok: true, data: v2 });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// Listar ventas (opcional: ?cajaId=ID&estado=completada|anulada|todas)
router.get("/", async (req, res) => {
  try {
    const { cajaId, estado } = req.query;

    const q = {};
    if (cajaId) {
      if (!isValidObjectId(String(cajaId))) {
        return res.status(400).json({ ok: false, error: "cajaId inválido" });
      }
      q.cajaId = String(cajaId);
    }

    if (!estado || estado === "completada") q.estado = "completada";
    else if (estado === "anulada") q.estado = "anulada";
    // estado=todas -> no filtra

    const ventas = await Venta.find(q).sort({ createdAt: -1 }).limit(200);
    return res.json({ ok: true, data: ventas });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
