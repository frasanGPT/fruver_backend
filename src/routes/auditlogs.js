// src/routes/auditlogs.js

import { Router } from "express";
import AuditLog from "../models/AuditLog.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

/* =========================
   GET AUDIT LOGS (PAGINADO)
========================= */

router.get("/", async (req, res) => {
  try {
    const {
      usuarioId,
      accion,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(parseInt(page), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit), 1), 100); // máximo 100

    const filtro = {};

    if (usuarioId) filtro.usuarioId = usuarioId;
    if (accion) filtro.accion = accion;

    const total = await AuditLog.countDocuments(filtro);

    const logs = await AuditLog.find(filtro)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.json({
      ok: true,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      limit: limitNumber,
      data: logs,
    });
  } catch (err) {
    console.error("GET AUDIT LOGS ERROR:", err);
    res.status(500).json({
      ok: false,
      error: "Error al obtener auditoría",
    });
  }
});

export default router;