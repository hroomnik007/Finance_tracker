import path from "node:path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { startWeeklyReportJob, startMonthlyReportJob } from "./jobs/weeklyReport";
import authRouter from "./routes/auth";
import transactionsRouter from "./routes/transactions";
import categoriesRouter from "./routes/categories";
import adminRouter from "./routes/admin";
import sharedReportsRouter from "./routes/sharedReports";
import householdsRouter from "./routes/households";
import savingsRouter from "./routes/savings";
import notificationsRouter from "./routes/notifications";
import achievementsRouter from "./routes/achievements";
import { authenticateToken } from "./middleware/authenticate";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins =
  env.NODE_ENV === "production"
    ? ["https://finvu.pedani.eu"]
    : ["http://localhost:5173", "http://localhost:3000"];

// crossOriginResourcePolicy must allow cross-origin so the frontend origin
// (financie.pedani.eu) can embed avatars served from api.pedani.eu/uploads.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(
  cors({
    // Use a function so that requests without an Origin header (PWA standalone
    // mode on some mobile browsers) are allowed through instead of rejected.
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
// Only the avatar upload needs a large body (base64 photo); everything else
// gets a tight limit so oversized payloads are rejected early.
const jsonDefault = express.json({ limit: "1mb" });
const jsonAvatar = express.json({ limit: "15mb" });
app.use((req, res, next) =>
  req.path === "/api/auth/avatar" ? jsonAvatar(req, res, next) : jsonDefault(req, res, next)
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Uploaded files (avatars) — URLs carry a ?v= cache-buster, so long immutable caching is safe
app.use(
  "/uploads",
  express.static(path.resolve(env.UPLOAD_DIR), { maxAge: "365d", immutable: true, fallthrough: false })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reports", sharedReportsRouter);
app.use("/api/households", authenticateToken, householdsRouter);
app.use("/api/savings", savingsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/achievements", achievementsRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  startWeeklyReportJob();
  startMonthlyReportJob();
});

export default app;
