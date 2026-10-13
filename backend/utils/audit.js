const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

// Writes one "who did what" line. Fire-and-forget: a logging problem must never break the admin action.
function audit(req, action, target = "", detail = "") {
  (async () => {
    const actor = await User.findById(req.user.id).select("name").lean();
    await AuditLog.create({
      actor: req.user.id,
      actorName: actor ? actor.name : "",
      actorRole: req.user.role,
      action,
      target: String(target).slice(0, 120),
      detail: String(detail).slice(0, 200),
    });
  })().catch(() => {});
}

module.exports = audit;
