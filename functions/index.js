
const { https } = require("firebase-functions");
const next = require("next");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, conf: { distDir: path.join(process.cwd(), ".next") } });
const handle = app.getRequestHandler();

exports.server = https.onRequest(async (req, res) => {
  try {
    await app.prepare();
    return handle(req, res);
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).send("Internal Server Error");
  }
});
