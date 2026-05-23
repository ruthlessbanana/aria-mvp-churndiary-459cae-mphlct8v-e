import { z } from "zod";

import { getDbPool } from "@/lib/db";
import { okJson } from "@/lib/server/api/json-response";
import { parseJsonBody } from "@/lib/server/api/parse-body";
import { requireSession } from "@/lib/server/api/require-session";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { sendEmail } from "@/lib/server/email/send-email";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const createSchema = z.object({
  serviceName: z.string().trim().min(1).max(120),
  trialStartDate: z.string().trim().min(1),
  trialConversionDate: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const POST = withApiErrorHandling(async (req) => {
  const { user } = await requireSession();
  const body = await parseJsonBody(req, createSchema);

  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    trial_conversion_date: string;
    status: string;
  }>(
    `INSERT INTO "trial_entries"
       (user_id, service_name, trial_start_date, trial_conversion_date, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, service_name, trial_conversion_date, status`,
    [
      user.id,
      body.serviceName,
      body.trialStartDate,
      body.trialConversionDate,
      body.notes ?? null,
    ]
  );
  const row = rows[0];
  logger.info("trial_created", { user_id: user.id, id: row.id });

  if (user.email) {
    try {
      const outcome = await sendEmail({
        to: user.email,
        subject: `Watching your ${row.service_name} trial`,
        html: `<p>Hi${user.name ? ` ${user.name}` : ""},</p>
<p>ChurnDiary will email you a reminder before your <strong>${row.service_name}</strong> trial converts on ${row.trial_conversion_date}.</p>
<p>You can review or edit this trial anytime from your ChurnDiary home.</p>`,
      });
      if (!outcome.ok) {
        await pool.query(
          `INSERT INTO "app_events" (user_id, event_type, payload)
           VALUES ($1, $2, $3)`,
          [
            user.id,
            "trial_created_email_failed",
            JSON.stringify({ trial_id: row.id, error: outcome.error }),
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO "app_events" (user_id, event_type, payload)
           VALUES ($1, $2, $3)`,
          [
            user.id,
            "trial_created_email_sent",
            JSON.stringify({ trial_id: row.id, provider: outcome.provider }),
          ]
        );
      }
    } catch (e) {
      logger.error("trial_created_email_throw", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return okJson({
    trial: {
      id: row.id,
      title: row.service_name,
      serviceName: row.service_name,
      trialConversionDate: row.trial_conversion_date,
      status: row.status,
    },
  });
});

export const GET = withApiErrorHandling(async () => {
  const { user } = await requireSession();
  const pool = getDbPool();
  const { rows } = await pool.query<{
    id: string;
    service_name: string;
    trial_start_date: string;
    trial_conversion_date: string;
    status: string;
    reminder_sent: boolean;
  }>(
    `SELECT id, service_name, trial_start_date, trial_conversion_date, status, reminder_sent
     FROM "trial_entries"
     WHERE user_id = $1
     ORDER BY trial_conversion_date ASC, created_at DESC`,
    [user.id]
  );
  return okJson({
    trials: rows.map((r) => ({
      id: r.id,
      serviceName: r.service_name,
      trialStartDate: r.trial_start_date,
      trialConversionDate: r.trial_conversion_date,
      status: r.status,
      reminderSent: r.reminder_sent,
    })),
  });
});
