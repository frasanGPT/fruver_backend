// src/models/Arqueo.js
import mongoose from "mongoose";

const ArqueoSchema = new mongoose.Schema(
  {
    cajaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Caja",
      required: true,
      index: true,
    },

    fechaCierre: { type: Date, default: Date.now },

    // Nuevo (preferido). OJO: no lo hago "required: true" aquí,
    // porque permitimos legacy (solo conteoFisicoEfectivo) y lo normalizamos en validate.
    conteoFisicoTotal: { type: Number, min: 0 },

    // Legacy/compat
    conteoFisicoEfectivo: { type: Number, min: 0 },

    totalSistema: { type: Number, required: true, min: 0 },
    diferencia: { type: Number, required: true },

    observaciones: { type: String, trim: true, default: "" },
    aprobadoPor: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    strict: true,
    minimize: false,
  }
);

// ✅ Normaliza SIEMPRE ambos, y valida presencia de al menos uno
ArqueoSchema.pre("validate", function () {
  const hasTotal = this.conteoFisicoTotal !== undefined && this.conteoFisicoTotal !== null;
  const hasEfe = this.conteoFisicoEfectivo !== undefined && this.conteoFisicoEfectivo !== null;

  // si no mandaron ninguno -> error de validación claro
  if (!hasTotal && !hasEfe) {
    this.invalidate(
      "conteoFisicoTotal",
      "Debe enviar conteoFisicoTotal (recomendado) o conteoFisicoEfectivo (legacy)"
    );
    return;
  }

  // si viene legacy, lo mapeamos a total
  if (!hasTotal && hasEfe) this.conteoFisicoTotal = this.conteoFisicoEfectivo;

  // si viene total, lo replicamos a legacy para compat temporal
  if (hasTotal && !hasEfe) this.conteoFisicoEfectivo = this.conteoFisicoTotal;
});

// ✅ Índice único con nombre explícito (evita conflictos de nombres auto-generados)
ArqueoSchema.index({ cajaId: 1 }, { unique: true, name: "cajaId_1_unique" });

// ✅ Respuesta consistente: siempre ambos campos al convertir a JSON
function normalizeOutput(_doc, ret) {
  if (ret.conteoFisicoTotal == null && ret.conteoFisicoEfectivo != null) {
    ret.conteoFisicoTotal = ret.conteoFisicoEfectivo;
  }
  if (ret.conteoFisicoEfectivo == null && ret.conteoFisicoTotal != null) {
    ret.conteoFisicoEfectivo = ret.conteoFisicoTotal;
  }
  return ret;
}

ArqueoSchema.set("toObject", { transform: normalizeOutput });
ArqueoSchema.set("toJSON", { transform: normalizeOutput });

export default mongoose.model("Arqueo", ArqueoSchema);
