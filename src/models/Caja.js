import mongoose from "mongoose";

const TotalesSchema = new mongoose.Schema(
  {
    efectivo: { type: Number, default: 0, min: 0 },
    transferencia: { type: Number, default: 0, min: 0 },
    qr: { type: Number, default: 0, min: 0 },
    llave: { type: Number, default: 0, min: 0 },
    bono: { type: Number, default: 0, min: 0 },
    debito: { type: Number, default: 0, min: 0 },
    credito: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const CajaSchema = new mongoose.Schema(
  {
    fechaApertura: { type: Date, default: Date.now },
    usuario: { type: String, required: true, trim: true },
    saldoInicial: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ["abierta", "cerrada"], default: "abierta" },
    totales: { type: TotalesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("Caja", CajaSchema);
