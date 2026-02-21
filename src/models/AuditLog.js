import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null,
  },
  usuarioEmail: {
    type: String,
    required: true,
  },
  accion: {
    type: String,
    required: true,
  },
  entidad: {
    type: String,
    required: true,
  },
  entidadId: {
    type: String,
  },
  metadata: {
    type: Object,
  },
  ip: {
    type: String,
  },
}, {
  timestamps: true
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;