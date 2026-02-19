// src/middlewares/auth.js
import { verifyToken } from "../config/jwt.js";

export function requireAuth(req, res, next) {
  try {
    const auth = String(req.headers.authorization || "").trim();

    // Espera: "Bearer <token>"
    const space = auth.indexOf(" ");
    const type = space === -1 ? auth : auth.slice(0, space);
    const token = space === -1 ? "" : auth.slice(space + 1).trim();

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, error: "Falta token Bearer" });
    }

    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    // Si tu verifyToken expone nombre de error (ej: TokenExpiredError), puedes diferenciar:
    const msg =
      err?.name === "TokenExpiredError" ? "Token expirado" : "Token inválido";

    return res.status(401).json({ ok: false, error: msg });
  }
}
