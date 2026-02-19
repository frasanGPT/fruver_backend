// src/routes/cajas.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import Caja from "../models/Caja.js";
import Arqueo from "../models/Arqueo.js";
import mongoose from "mongoose";

const router = Router();
router.use(requireAuth);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Abrir caja
router.post("/abrir", async (req, res) => {
  try {
    const { usuario, saldoInicial } = req.body;

    if (!usuario || typeof usuario !== "string") {
      return res.status(400).json({ ok: false, error: "usuario es requerido" });
    }

    if (
      saldoInicial === undefined ||
      Number.isNaN(Number(saldoInicial)) ||
      Number(saldoInicial) < 0
    ) {
      return res.status(400).json({ ok: false, error: "saldoInicial inválido" });
    }

    const caja = await Caja.create({
      usuario: usuario.trim(),
      saldoInicial: Number(saldoInicial),
      estado: "abierta",
    });

    return res.status(201).json({ ok: true, data: caja });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Listar cajas (últimas 50)
router.get("/", async (_req, res) => {
  try {
    const cajas = await Caja.find().sort({ createdAt: -1 }).limit(50);
    return res.json({ ok: true, data: cajas });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Obtener caja por ID (incluye arqueo si existe)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const caja = await Caja.findById(id);
    if (!caja) return res.status(404).json({ ok: false, error: "Caja no encontrada" });

    const arqueo = await Arqueo.findOne({ cajaId: caja._id }).sort({ createdAt: -1 });

    return res.json({ ok: true, data: { caja, arqueo } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Cerrar caja + arqueo (standalone-safe, sin transacciones)
// ✅ Cierra caja de forma atómica (solo si está abierta)
// ✅ Crea arqueo con unique(cajaId) y si falla, revierte caja a "abierta"
// ✅ Devuelve SIEMPRE ambos: conteoFisicoTotal y conteoFisicoEfectivo
router.post("/:id/cerrar", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const {
      conteoFisicoTotal,
      conteoFisicoEfectivo,
      observaciones = "",
      aprobadoPor = "",
    } = req.body;

    // 0) Resolver conteo físico (prioriza nuevo, si no usa legacy)
    const rawConteo =
      conteoFisicoTotal !== undefined && conteoFisicoTotal !== null
        ? conteoFisicoTotal
        : conteoFisicoEfectivo;

    if (rawConteo === undefined || rawConteo === null) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar conteoFisicoTotal (recomendado) o conteoFisicoEfectivo (legacy)",
      });
    }

    const cfTotal = Number(rawConteo);
    if (Number.isNaN(cfTotal) || cfTotal < 0) {
      return res.status(400).json({ ok: false, error: "Conteo físico inválido" });
    }

    // 1) Cerrar caja atómico SOLO si está abierta
    const caja = await Caja.findOneAndUpdate(
      { _id: id, estado: "abierta" },
      { $set: { estado: "cerrada" } },
      { new: true }
    );

    if (!caja) {
      const existe = await Caja.findById(id).select("_id estado");
      if (!existe) return res.status(404).json({ ok: false, error: "Caja no encontrada" });
      return res.status(400).json({ ok: false, error: "Caja no está abierta" });
    }

    // 2) totalSistema = saldoInicial + sumatoria totales
    const t = caja.totales || {};
    const totalMovimientos =
      Number(t.efectivo || 0) +
      Number(t.transferencia || 0) +
      Number(t.qr || 0) +
      Number(t.llave || 0) +
      Number(t.bono || 0) +
      Number(t.debito || 0) +
      Number(t.credito || 0);

    const totalSistema = Number(caja.saldoInicial || 0) + totalMovimientos;
    const diferencia = cfTotal - totalSistema;

    // 3) Crear arqueo
    const payload = {
      cajaId: caja._id,
      conteoFisicoTotal: cfTotal,
      totalSistema,
      diferencia,
      observaciones: String(observaciones || ""),
      aprobadoPor: String(aprobadoPor || ""),
    };

    // si mandan legacy, lo validamos (pero no es obligatorio)
    if (conteoFisicoEfectivo !== undefined && conteoFisicoEfectivo !== null) {
      const cfLegacy = Number(conteoFisicoEfectivo);
      if (Number.isNaN(cfLegacy) || cfLegacy < 0) {
        // revertir cierre si legacy inválido
        await Caja.updateOne({ _id: caja._id, estado: "cerrada" }, { $set: { estado: "abierta" } });
        return res.status(400).json({ ok: false, error: "conteoFisicoEfectivo inválido" });
      }
      payload.conteoFisicoEfectivo = cfLegacy;
    }

    let arqueo;
    try {
      arqueo = await Arqueo.create(payload);
    } catch (e) {
      // revertir estado de caja si no se pudo crear arqueo
      await Caja.updateOne({ _id: caja._id, estado: "cerrada" }, { $set: { estado: "abierta" } });

      if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
        return res.status(400).json({
          ok: false,
          error: "Ya existe un arqueo para esta caja (posible doble cierre)",
        });
      }
      return res.status(500).json({ ok: false, error: String(e) });
    }

    // 4) Normalizar respuesta: SIEMPRE devolver ambos campos
    const arqueoObj = arqueo.toObject();
    if (arqueoObj.conteoFisicoTotal == null && arqueoObj.conteoFisicoEfectivo != null) {
      arqueoObj.conteoFisicoTotal = arqueoObj.conteoFisicoEfectivo;
    }
    if (arqueoObj.conteoFisicoEfectivo == null && arqueoObj.conteoFisicoTotal != null) {
      arqueoObj.conteoFisicoEfectivo = arqueoObj.conteoFisicoTotal;
    }

    return res.json({ ok: true, data: { caja, arqueo: arqueoObj } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Actualizar totales (solo si caja abierta)
router.patch("/:id/totales", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const caja = await Caja.findById(id);
    if (!caja) return res.status(404).json({ ok: false, error: "Caja no encontrada" });
    if (caja.estado !== "abierta") {
      return res.status(400).json({ ok: false, error: "Solo se puede actualizar una caja abierta" });
    }

    const metodos = ["efectivo", "transferencia", "qr", "llave", "bono", "debito", "credito"];

    for (const m of metodos) {
      if (req.body[m] !== undefined) {
        const v = Number(req.body[m]);
        if (Number.isNaN(v) || v < 0) {
          return res.status(400).json({ ok: false, error: `Valor inválido para ${m}` });
        }
        caja.totales[m] = v;
      }
    }

    await caja.save();
    return res.json({ ok: true, data: caja });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
