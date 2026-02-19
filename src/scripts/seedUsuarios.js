import mongoose from "mongoose";
import Usuario from "../models/Usuario.js";

const MONGO_URI = "mongodb://admin:admin123@127.0.0.1:27017/fruver_base_rlcero?authSource=admin";

async function seed() {
  await mongoose.connect(MONGO_URI);

  await Usuario.deleteMany({}); // Limpia usuarios previos

  const usuarios = [
    {
      nombre: "Administrador General",
      email: "admin@fruver.com",
      password: "admin123",
      rol: "admin",
    },
    {
      nombre: "Supervisor Principal",
      email: "supervisor@fruver.com",
      password: "supervisor123",
      rol: "supervisor",
    },
    {
      nombre: "Cajero 1",
      email: "cajero@fruver.com",
      password: "cajero123",
      rol: "cajero",
    },
    {
      nombre: "Vendedor 1",
      email: "vendedor@fruver.com",
      password: "vendedor123",
      rol: "vendedor",
    },
  ];

  await Usuario.insertMany(usuarios);

  console.log("Usuarios creados correctamente");
  process.exit();
}

seed();
