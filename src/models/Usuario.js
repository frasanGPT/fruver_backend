// src/models/Usuario.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["admin", "supervisor", "cajero", "vendedor"];

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    rol: {
      type: String,
      enum: ROLES,
      required: true,
      default: "vendedor",
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ===== HASH PASSWORD ===== */

usuarioSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

/* ===== COMPARE PASSWORD ===== */

usuarioSchema.methods.comparePassword = async function (passwordIngresado) {
  return await bcrypt.compare(passwordIngresado, this.password);
};

const Usuario = mongoose.model("Usuario", usuarioSchema);

export default Usuario;

