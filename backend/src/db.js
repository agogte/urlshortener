const mongoose = require("mongoose");
const logger = require("./logger");
const { dbQueryDuration, activeShortUrls } = require("./metrics");

async function connect() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/urlshortener";
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info({ uri }, "Connected to MongoDB");
}

mongoose.connection.on("error", (err) => {
  logger.error({ err }, "MongoDB connection error");
});

// Thin wrapper that times any async Mongoose operation
async function timed(operation, fn) {
  const end = dbQueryDuration.startTimer({ operation });
  try {
    const result = await fn();
    end();
    return result;
  } catch (err) {
    end();
    throw err;
  }
}

async function seedGauge(Url) {
  const count = await Url.countDocuments();
  activeShortUrls.set(count);
}

module.exports = { connect, timed, seedGauge };
