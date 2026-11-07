import { prisma } from "@/lib/db";
import { z } from "zod";

export const settingsSchema = z.object({
  /** Max new cards introduced per day in spaced repetition (per deck selection). */
  newCardsPerDay: z.number().int().min(0).max(1000).default(20),
  /** Max reviews per spaced repetition session. */
  maxReviewsPerSession: z.number().int().min(1).max(2000).default(200),
  /** Accept small typos in Learn mode. */
  allowTypos: z.boolean().default(true),
});
export type Settings = z.infer<typeof settingsSchema>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const raw: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      raw[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore broken values */
    }
  }
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : settingsSchema.parse({});
}

export async function updateSettings(data: Partial<Settings>) {
  const parsed = settingsSchema.partial().parse(data);
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
  }
  return getSettings();
}
