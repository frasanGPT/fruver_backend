import jwt from "jsonwebtoken";

export function generateToken(usuario) {
  return jwt.sign(
    {
      id: usuario._id,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}
