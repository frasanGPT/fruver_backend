export function requireRole(rolesPermitidos = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        ok: false,
        error: `Rol ${req.user.rol} no autorizado`,
      });
    }

    next();
  };
}
