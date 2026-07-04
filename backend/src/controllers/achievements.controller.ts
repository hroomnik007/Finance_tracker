import { Response } from "express";
import { AuthRequest } from "../middleware/authenticate";
import { evaluateAchievements } from "../services/achievements.service";

export async function getAchievements(req: AuthRequest, res: Response): Promise<void> {
  const state = await evaluateAchievements(req.userId!);
  res.json({ data: state });
}
