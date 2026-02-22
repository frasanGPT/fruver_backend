// src/middlewares/roles.js
import AuditLog from "../models/AuditLog.js";

function getClientIp(req) {
  const cf = req.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = req.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const ip = req.ip || "";
  return ip.replace(/^::ffff:/, "");
}

export function requireRole(rolesPermitidos) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }

    const roles = Array.isArray(rolesPermitidos)
      ? rolesPermitidos
      : [rolesPermitidos];

    if (!roles.includes(req.user.rol)) {
      // ✅ Auditar denegación por rol (403)
      try {
        await AuditLog.create({
          usuarioId: req.user.id || null,
          usuarioEmail: req.user.email || null,
          accion: "ACCESO_DENEGADO",
          entidad: "Sistema",
          entidadId: null,
          metadata: {
            motivo: "ROL_NO_AUTORIZADO",
            status: 403,
            method: req.method,
            ruta: req.originalUrl,
            rol: req.user.rol,
            rolesPermitidos: roles,
          },
          ip: getClientIp(req),
        });
      } catch (_) {}

      return res.status(403).json({
        ok: false,
        error: `Rol ${req.user.rol} no autorizado`,
      });
    }

    next();
  };
}