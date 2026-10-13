const mongoose = require("mongoose");

// Website settings managed from Admin -> Settings. There is only ONE document (key = "app").
const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "app", unique: true },
    registrationEnabled: { type: Boolean, default: true }, // false = "New registrations are closed"
    ramadanEnabled: { type: Boolean, default: true }, // false = Ramadan page + /api/ramadan switched off
    siteNotice: { type: String, default: "", trim: true, maxlength: 200 }, // banner shown on every page when not empty
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
