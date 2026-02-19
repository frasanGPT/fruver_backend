import mongoose from "mongoose";

const ProductoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, index: true },
    precio: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Producto", ProductoSchema);
