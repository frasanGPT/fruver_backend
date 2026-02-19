// src/models/Venta.js
import mongoose from "mongoose";

const VentaItemSchema = new mongoose.Schema(
  {
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: "Producto" },
    nombre: { type: String, trim: true, default: "" }, // snapshot
    precio: { type: Number, min: 0, default: 0 },
    cantidad: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const VentaSchema = new mongoose.Schema(
  {
    cajaId: { type: mongoose.Schema.Types.ObjectId, ref: "Caja", required: true, index: true },

    metodo: {
      type: String,
      required: true,
      enum: ["efectivo", "transferencia", "qr", "llave", "bono", "debito", "credito"],
    },

    total: { type: Number, required: true, min: 0 },

    items: { type: [VentaItemSchema], default: [] },

    estado: { type: String, enum: ["completada", "anulada"], default: "completada", index: true },

    notas: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Venta", VentaSchema);
