const mongoose = require("mongoose");

// Server errors (HTTP 500+) shown in Admin -> Error Logs.
// No request bodies, headers, tokens or query strings are stored.
const errorLogSchema = new mongoose.Schema(
  {
    method: { type: String, maxlength: 10 },
    path: { type: String, maxlength: 300 },
    statusCode: { type: Number },
    message: { type: String, maxlength: 500 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Old logs delete themselves after 30 days
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("ErrorLog", errorLogSchema);
