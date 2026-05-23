import { z } from "zod";

import { getDbPool } from "@/lib/db";
import { ApiError } from "@/lib/server/api/api-error";
import { okJson } from "@/lib/server/api/json-response";
import { parseJsonBody } from "@/lib/server/api/parse-body";
import { requireSession } from "@/lib/server/api/require-session";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const patchSchema = z.object({
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

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling<Ctx>(async (_req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    cancel_date: string;
    monthly_cost_saved: string | null;
    reason: string;
    reason_notes: string | null;
    mood: number;
    share_token: string | null;
  }>(
    `SELECT id, service_name, cancel_date, monthly_cost_saved, reason, reason_notes, mood, share_token
     FROM "cancellation_entries"
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, user.id]
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  return okJson({
    cancellation: {
      id: row.id,
      serviceName: row.service_name,
      cancelDate: row.cancel_date,
      monthlyCostSaved: row.monthly_cost_saved !== null ? Number(row.monthly_cost_saved) : null,
      reason: row.reason,
      reasonNotes: row.reason_notes,
      mood: row.mood,
      shareToken: row.share_token,
    },
  });
});

export const PATCH = withApiErrorHandling<Ctx>(async (req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const body = await parseJsonBody(req, patchSchema);

  const pool = getDbPool();
  const { rows } = await pool.query<{ id: string; service_name: string }>(
    `UPDATE "cancellation_entries"
       SET service_name = $3,
           cancel_date = $4,
           monthly_cost_saved = $5,
           reason = $6,
           reason_notes = $7,
           mood = $8,
           updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, service_name`,
    [
      id,
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
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  logger.info("cancellation_updated", { user_id: user.id, id: row.id });
  return okJson({
    cancellation: { id: row.id, serviceName: row.service_name, title: row.service_name },
  });
});

export const DELETE = withApiErrorHandling<Ctx>(async (_req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const pool = getDbPool();
  const { rows } = await pool.query<{ id: string }>(
    `DELETE FROM "cancellation_entries"
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, user.id]
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  logger.info("cancellation_deleted", { user_id: user.id, id });
  return okJson({ id: row.id });
});
