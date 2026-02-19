// src/config/jwt.js
import jwt from "jsonwebtoken";

// ✅ Dev fallback (constante) — cambiar en prod
const DEV_FALLBACK = "TEMP_DEV_JWT_SECRET_CAMBIAR_EN_PROD_2026";

function getEnv(name, fallback = "") {
  const v = process.env[name];
  if (v == null) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

export function getJwtSecret() {
  // Si existe JWT_SECRET, úsalo. Si no, usa fallback DEV.
  return getEnv("JWT_SECRET", DEV_FALLBACK);
}

export function getJwtExpiresIn() {
  return getEnv("JWT_EXPIRES_IN", "7d");
}

export function assertJwtReady() {
  const secret = getJwtSecret();

  // Si estás en producción, NO permitimos fallback.
  const env = getEnv("NODE_ENV", "development");
  const isProd = env === "production";

  if (isProd && secret === DEV_FALLBACK) {
    throw new Error("JWT_SECRET no configurado (en producción no se permite fallback).");
  }

  // Aún en dev, secret debe tener longitud mínima razonable
  if (String(secret).length < 10) {
    throw new Error("JWT_SECRET es demasiado corto (mín 10 caracteres).");
  }

  return true;
}

export function signToken(payload) {
  const secret = getJwtSecret();
  const expiresIn = getJwtExpiresIn();
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}
