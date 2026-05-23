import { z } from "zod";

import { getDbPool } from "@/lib/db";
import { okJson } from "@/lib/server/api/json-response";
import { parseJsonBody } from "@/lib/server/api/parse-body";
import { requireSession } from "@/lib/server/api/require-session";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const createSchema = z.object({
  serviceName: z.string().trim().min(1).max(120),
  cancelDate: z.string().trim().min(1),
  monthlyCostSaved: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  reason: z.enum(["price", "quality", "unused", "found_better", "other"]),
  reasonNotes: z.string().trim().max(2000).optional().nullable(),
  mood: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine((n) => n >= 1 && n <= 5, "mood must be 1-5"),
});

export const POST = withApiErrorHandling(async (req) => {
  const { user } = await requireSession();
  const body = await parseJsonBody(req, createSchema);

  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    cancel_date: string;
    reason: string;
    mood: number;
  }>(
    `INSERT INTO "cancellation_entries"
       (user_id, service_name, cancel_date, monthly_cost_saved, reason, reason_notes, mood)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, service_name, cancel_date, reason, mood`,
    [
      user.id,
      body.serviceName,
      body.cancelDate,
      body.monthlyCostSaved,
      body.reason,
      body.reasonNotes ?? null,
      body.mood,
    ]
  );
  const row = rows[0];
  logger.info("cancellation_created", { user_id: user.id, id: row.id });
  return okJson({
    cancellation: {
      id: row.id,
      title: row.service_name,
      serviceName: row.service_name,
      cancelDate: row.cancel_date,
      reason: row.reason,
      mood: row.mood,
    },
  });
});

export const GET = withApiErrorHandling(async () => {
  const { user } = await requireSession();
  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    cancel_date: string;
    monthly_cost_saved: string | null;
    reason: string;
    mood: number;
  }>(
    `SELECT id, service_name, cancel_date, monthly_cost_saved, reason, mood
     FROM "cancellation_entries"
     WHERE user_id = $1
     ORDER BY cancel_date DESC, created_at DESC`,
    [user.id]
  );
  return okJson({
    cancellations: rows.map((r) => ({
      id: r.id,
      serviceName: r.service_name,
      cancelDate: r.cancel_date,
      monthlyCostSaved: r.monthly_cost_saved !== null ? Number(r.monthly_cost_saved) : null,
      reason: r.reason,
      mood: r.mood,
    })),
  });
});
