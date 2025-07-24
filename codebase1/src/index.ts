
"use strict";

import * as admin from "firebase-admin";
import { https } from "firebase-functions";
import next from "next";
import path from "path";

admin.initializeApp();

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, conf: { distDir: path.join(__dirname, '..', '.next') } });
const handle = app.getRequestHandler();

export const codebase1 = https.onRequest(async (req, res) => {
  try {
    await app.prepare();
    return handle(req, res);
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).send("Internal Server Error");
  }
});

export * from "./checkAdmin";
