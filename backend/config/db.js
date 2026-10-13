const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI from environment variables.
 * Exits the process if the connection fails, since SIRAJ cannot
 * function without its database.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[SIRAJ] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[SIRAJ] MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
