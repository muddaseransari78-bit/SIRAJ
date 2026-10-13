const mongoose = require("mongoose");

// "Who did what" in the admin portal (role changes, deactivations, broadcasts, settings...).
// Never stores passwords, tokens, request bodies or message text beyond a short detail line.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, maxlength: 80, default: "" },
    actorRole: { type: String, maxlength: 20, default: "" },
    action: { type: String, required: true, maxlength: 40 },
    target: { type: String, maxlength: 120, default: "" },
    detail: { type: String, maxlength: 200, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
// Keep one year of history, then delete automatically
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
