import { Request, Response } from "express";
import { createWorker } from "tesseract.js";

export async function scanReceipt(req: Request, res: Response): Promise<void> {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    res.status(400).json({ error: "Nebol nahraný žiadny súbor." });
    return;
  }

  let rawText = "";
  try {
    const worker = await createWorker("eng+slk");
    const { data } = await worker.recognize(file.buffer);
    rawText = data.text;
    await worker.terminate();
  } catch {
    res.status(500).json({ error: "Nepodarilo sa spracovať obrázok." });
    return;
  }

  const amount = extractAmount(rawText);
  const date = extractDate(rawText);

  res.json({ amount, date, rawText });
}

function extractAmount(text: string): number | null {
  const patterns = [
    /(?:SPOLU|CELKOM|TOTAL|SUMA|SUM|K PLATBE)[^\d]*(\d+[.,]\d{2})/i,
    /(\d+[.,]\d{2})\s*(?:EUR|€)/i,
    /(?:EUR|€)\s*(\d+[.,]\d{2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(",", "."));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  // fallback: find largest decimal number
  const allNums = [...text.matchAll(/\b(\d{1,6}[.,]\d{2})\b/g)];
  if (allNums.length > 0) {
    const vals = allNums.map(m => parseFloat(m[1].replace(",", "."))).filter(v => !isNaN(v) && v > 0);
    if (vals.length > 0) return Math.max(...vals);
  }
  return null;
}

function extractDate(text: string): string | null {
  const ddmmyyyy = text.match(/\b(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})\b/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const yyyymmdd = text.match(/\b(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\b/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}
