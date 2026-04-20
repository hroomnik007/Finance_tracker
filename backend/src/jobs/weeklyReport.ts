import cron from "node-cron";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { users, transactions } from "../db/schema";
import { sendEmail } from "../lib/email";

function getLastWeekRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setDate(now.getDate() - 1);
  const from = new Date(to);
  from.setDate(to.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { from: fmt(from), to: fmt(to) };
}

function formatAmount(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

async function sendWeeklyReports(): Promise<void> {
  const { from, to } = getLastWeekRange();

  const subscribers = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.weeklyEmailEnabled, true));

  for (const user of subscribers) {
    const txs = await db
      .select({
        type: transactions.type,
        amount: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.date, from),
          lte(transactions.date, to)
        )
      )
      .groupBy(transactions.type);

    const income = txs.find((r) => r.type === "income");
    const expense = txs.find((r) => r.type === "expense");
    const totalIncome = parseFloat(income?.amount ?? "0");
    const totalExpense = parseFloat(expense?.amount ?? "0");
    const balance = totalIncome - totalExpense;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#0D0A1A;color:#E2D9F3;padding:32px;max-width:480px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:28px;">
    <h1 style="font-size:22px;font-weight:700;color:#E2D9F3;margin:0 0 4px;">Finvu — Týždenný prehľad</h1>
    <p style="font-size:13px;color:#9D84D4;margin:0;">${from} – ${to}</p>
  </div>
  <div style="background:#2A1F4A;border-radius:16px;padding:20px;margin-bottom:16px;">
    <p style="font-size:12px;color:#9D84D4;margin:0 0 4px;">Príjmy</p>
    <p style="font-size:24px;font-weight:700;color:#34D399;margin:0;font-family:monospace;">+${formatAmount(totalIncome)}</p>
  </div>
  <div style="background:#2A1F4A;border-radius:16px;padding:20px;margin-bottom:16px;">
    <p style="font-size:12px;color:#9D84D4;margin:0 0 4px;">Výdavky</p>
    <p style="font-size:24px;font-weight:700;color:#F87171;margin:0;font-family:monospace;">-${formatAmount(totalExpense)}</p>
  </div>
  <div style="background:#1E1535;border:1px solid #4C3A8A;border-radius:16px;padding:20px;">
    <p style="font-size:12px;color:#9D84D4;margin:0 0 4px;">Rozdiel</p>
    <p style="font-size:28px;font-weight:700;color:${balance >= 0 ? "#34D399" : "#F87171"};margin:0;font-family:monospace;">${balance >= 0 ? "+" : ""}${formatAmount(balance)}</p>
  </div>
  <p style="font-size:12px;color:#6B5A9E;text-align:center;margin-top:24px;">
    Správu dostávaš, pretože máš zapnutý týždenný report v Finvu.<br>
    Vypnúť ho môžeš v Nastaveniach.
  </p>
</body>
</html>`;

    await sendEmail(user.email, "Finvu — Týždenný prehľad financií", html);
  }
}

export function startWeeklyReportJob(): void {
  cron.schedule("0 8 * * 1", () => {
    sendWeeklyReports().catch((err) =>
      console.error("[weeklyReport] Error:", err)
    );
  });
  console.log("[weeklyReport] Scheduled: every Monday 08:00");
}

function getPrevMonthRange(): { year: number; month: number; from: string; to: string; label: string } {
  const now = new Date();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const months = ["Január","Február","Marec","Apríl","Máj","Jún","Júl","August","September","Október","November","December"];
  return { year: y, month: m, from, to, label: `${months[m - 1]} ${y}` };
}

async function sendMonthlyReports(): Promise<void> {
  const { from, to, label } = getPrevMonthRange();

  const subscribers = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.monthlyEmailEnabled, true));

  for (const user of subscribers) {
    const txs = await db
      .select({ type: transactions.type, amount: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), gte(transactions.date, from), lte(transactions.date, to)))
      .groupBy(transactions.type);

    const totalIncome = parseFloat(txs.find((r) => r.type === "income")?.amount ?? "0");
    const totalExpense = parseFloat(txs.find((r) => r.type === "expense")?.amount ?? "0");
    const balance = totalIncome - totalExpense;

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#0D0A1A;color:#E2D9F3;padding:32px;max-width:480px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:28px;">
    <h1 style="font-size:22px;font-weight:700;color:#E2D9F3;margin:0 0 4px;">Finvu — Mesačný prehľad</h1>
    <p style="font-size:13px;color:#9D84D4;margin:0;">${label}</p>
  </div>
  <div style="background:#2A1F4A;border-radius:16px;padding:20px;margin-bottom:16px;">
    <p style="font-size:12px;color:#9D84D4;margin:0 0 4px;">Príjmy</p>
    <p style="font-size:24px;font-weight:700;color:#34D399;margin:0;font-family:monospace;">+${formatAmount(totalIncome)}</p>
  </div>
  <div style="background:#2A1F4A;border-radius:16px;padding:20px;margin-bottom:16px;">
    <p style="font-size:12px;color:#9D84D4;margin:0 0 4px;">Výdavky</p>
    <p style="font-size:24px;font-weight:700;color:#F87171;margin:0;font-family:monospace;">-${formatAmount(totalExpense)}</p>
  </div>
  <div style="background:#1E1535;border:1px solid #4C3A8A;border-radius:16px;padding:20px;">
    <p style="font-size:12px;color:#9D84D4;margin:0 0 4px;">Úspory</p>
    <p style="font-size:28px;font-weight:700;color:${balance >= 0 ? "#34D399" : "#F87171"};margin:0;font-family:monospace;">${balance >= 0 ? "+" : ""}${formatAmount(balance)}</p>
  </div>
  <p style="font-size:12px;color:#6B5A9E;text-align:center;margin-top:24px;">
    Správu dostávaš, pretože máš zapnutý mesačný report v Finvu.<br>
    Vypnúť ho môžeš v Nastaveniach.
  </p>
</body></html>`;

    await sendEmail(user.email, `Finvu — Mesačný prehľad (${label})`, html);
  }
}

export function startMonthlyReportJob(): void {
  // 1st of each month at 09:00
  cron.schedule("0 9 1 * *", () => {
    sendMonthlyReports().catch((err) =>
      console.error("[monthlyReport] Error:", err)
    );
  });
  console.log("[monthlyReport] Scheduled: 1st of month 09:00");
}
