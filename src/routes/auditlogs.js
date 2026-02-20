// src/routes/auditlogs.js

import { Router } from "express";
import AuditLog from "../models/AuditLog.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/roles.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

/* =========================
   GET AUDIT LOGS
========================= */

router.get("/", async (req, res) => {
  try {
    const { usuarioId, accion, limit = 50 } = req.query;

    const filtro = {};

    if (usuarioId) filtro.usuarioId = usuarioId;
    if (accion) filtro.accion = accion;

    const logs = await AuditLog.find(filtro)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({
      ok: true,
      count: logs.length,
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