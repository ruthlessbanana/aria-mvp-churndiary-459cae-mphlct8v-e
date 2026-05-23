import { z } from "zod";

import { getDbPool } from "@/lib/db";
import { okJson } from "@/lib/server/api/json-response";
import { parseJsonBody } from "@/lib/server/api/parse-body";
import { requireSession } from "@/lib/server/api/require-session";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const upsertSchema = z.object({
  emailEnabled: z.boolean().optional().default(true),
  reminderDaysBefore: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.round(n) : NaN;
    })
    .refine((n) => n >= 0 && n <= 60, "reminderDaysBefore must be 0-60"),
});

export const GET = withApiErrorHandling(async () => {
  const { user } = await requireSession();
  const pool = getDbPool();
  const { rows } = await pool.query<{
    email_enabled: boolean;
    reminder_days_before: number;
  }>(
    `SELECT email_enabled, reminder_days_before
     FROM "notification_preferences"
     WHERE user_id = $1
     LIMIT 1`,
    [user.id]
  );
  const row = rows[0];
  return okJson({
    preferences: {
      emailEnabled: row?.email_enabled ?? true,
      reminderDaysBefore: row?.reminder_days_before ?? 7,
    },
    emailEnabled: row?.email_enabled ?? true,
    reminderDaysBefore: row?.reminder_days_before ?? 7,
  });
});

export const POST = withApiErrorHandling(async (req) => {
  const { user } = await requireSession();
  const body = await parseJsonBody(req, upsertSchema);

  const pool = getDbPool();
  const { rows } = await pool.query<{
    email_enabled: boolean;
    reminder_days_before: number;
  }>(
    `INSERT INTO "notification_preferences" (user_id, email_enabled, reminder_days_before)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET email_enabled = EXCLUDED.email_enabled,
           reminder_days_before = EXCLUDED.reminder_days_before,
           updated_at = now()
     RETURNING email_enabled, reminder_days_before`,
    [user.id, body.emailEnabled, body.reminderDaysBefore]
  );
  const row = rows[0];
  logger.info("notification_preferences_saved", { user_id: user.id });
  return okJson({
    preferences: {
      emailEnabled: row.email_enabled,
      reminderDaysBefore: row.reminder_days_before,
    },
    emailEnabled: row.email_enabled,
    reminderDaysBefore: row.reminder_days_before,
  });
});
