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
  trialStartDate: z.string().trim().min(1),
  trialConversionDate: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["active", "cancelled", "converted"]),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling<Ctx>(async (_req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    trial_start_date: string;
    trial_conversion_date: string;
    notes: string | null;
    status: string;
    reminder_sent: boolean;
  }>(
    `SELECT id, service_name, trial_start_date, trial_conversion_date, notes, status, reminder_sent
     FROM "trial_entries"
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, user.id]
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  return okJson({
    trial: {
      id: row.id,
      serviceName: row.service_name,
      trialStartDate: row.trial_start_date,
      trialConversionDate: row.trial_conversion_date,
      notes: row.notes,
      status: row.status,
      reminderSent: row.reminder_sent,
    },
  });
});

export const PATCH = withApiErrorHandling<Ctx>(async (req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const body = await parseJsonBody(req, patchSchema);

  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    status: string;
  }>(
    `UPDATE "trial_entries"
        SET service_name = $3,
            trial_start_date = $4,
            trial_conversion_date = $5,
            notes = $6,
            status = $7,
            updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, service_name, status`,
    [
      id,
      user.id,
      body.serviceName,
      body.trialStartDate,
      body.trialConversionDate,
      body.notes ?? null,
      body.status,
    ]
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  logger.info("trial_updated", { user_id: user.id, id: row.id, status: row.status });
  return okJson({
    trial: {
      id: row.id,
      serviceName: row.service_name,
      title: row.service_name,
      status: row.status,
    },
  });
});

export const DELETE = withApiErrorHandling<Ctx>(async (_req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const pool = getDbPool();
  const { rows } = await pool.query<{ id: string }>(
    `DELETE FROM "trial_entries"
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, user.id]
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  logger.info("trial_deleted", { user_id: user.id, id });
  return okJson({ id: row.id });
});
