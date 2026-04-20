import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { startWeeklyReportJob, startMonthlyReportJob } from "./jobs/weeklyReport";
import authRouter from "./routes/auth";
import transactionsRouter from "./routes/transactions";
import categoriesRouter from "./routes/categories";
import adminRouter from "./routes/admin";
import ocrRouter from "./routes/ocr";
import sharedReportsRouter from "./routes/sharedReports";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins =
  env.NODE_ENV === "production"
    ? ["https://financie.pedani.eu", "https://finvu.pedani.eu"]
    : ["http://localhost:5173", "http://localhost:3000"];

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ocr", ocrRouter);
app.use("/api/reports", sharedReportsRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  startWeeklyReportJob();
  startMonthlyReportJob();
});

export default app;
