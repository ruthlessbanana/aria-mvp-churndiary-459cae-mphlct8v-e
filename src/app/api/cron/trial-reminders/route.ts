import { getDbPool } from "@/lib/db";
import { errJson, okJson } from "@/lib/server/api/json-response";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { sendEmail } from "@/lib/server/email/send-email";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

type DueRow = {
  id: string;
  user_id: string;
  service_name: string;
  trial_conversion_date: string;
  email: string | null;
  name: string | null;
  reminder_days_before: number;
  email_enabled: boolean;
};

async function runReminderJob() {
  const pool = getDbPool();

  const { rows } = await pool.query<DueRow>(
    `SELECT t.id, t.user_id, t.service_name, t.trial_conversion_date,
            u.email, u.name,
            COALESCE(p.reminder_days_before, 7) AS reminder_days_before,
            COALESCE(p.email_enabled, true) AS email_enabled
     FROM "trial_entries" t
     JOIN "user" u ON u.id = t.user_id
     LEFT JOIN "notification_preferences" p ON p.user_id = t.user_id
     WHERE t.status = 'active'
       AND t.reminder_sent = false
       AND t.trial_conversion_date <= (CURRENT_DATE + (COALESCE(p.reminder_days_before, 7)::text || ' days')::interval)`
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.email_enabled || !row.email) {
      skipped += 1;
      continue;
    }
    try {
      const outcome = await sendEmail({
        to: row.email,
        subject: `Your ${row.service_name} trial converts soon`,
        html: `<p>Hi${row.name ? ` ${row.name}` : ""},</p>
<p>Your free trial of <strong>${row.service_name}</strong> is set to convert on <strong>${row.trial_conversion_date}</strong>.</p>
<p>If you don't want to be charged, cancel before that date and log the cancellation in ChurnDiary.</p>`,
      });

      if (outcome.ok) {
        await pool.query(
          `UPDATE "trial_entries"
             SET reminder_sent = true, updated_at = now()
           WHERE id = $1`,
          [row.id]
        );
        await pool.query(
          `INSERT INTO "app_events" (user_id, event_type, payload)
           VALUES ($1, $2, $3)`,
          [
            row.user_id,
            "trial_reminder_due_email_sent",
            JSON.stringify({ trial_id: row.id, provider: outcome.provider }),
          ]
        );
        sent += 1;
      } else {
        failed += 1;
        await pool.query(
          `INSERT INTO "app_events" (user_id, event_type, payload)
           VALUES ($1, $2, $3)`,
          [
            row.user_id,
            "trial_reminder_due_email_failed",
            JSON.stringify({ trial_id: row.id, error: outcome.error }),
          ]
        );
      }
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : String(e);
      logger.error("trial_reminder_throw", { trial_id: row.id, error: message });
      try {
        await pool.query(
          `INSERT INTO "app_events" (user_id, event_type, payload)
           VALUES ($1, $2, $3)`,
          [
            row.user_id,
            "trial_reminder_due_email_failed",
            JSON.stringify({ trial_id: row.id, error: message }),
          ]
        );
      } catch {
        // swallow secondary log failure
      }
    }
  }

  return { candidates: rows.length, sent, skipped, failed };
}

function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return true;
  }
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export const GET = withApiErrorHandling(async (req) => {
  if (!authorizedCron(req)) {
    return errJson("unauthorized", 401);
  }
  const result = await runReminderJob();
  return okJson(result);
});

export const POST = withApiErrorHandling(async (req) => {
  if (!authorizedCron(req)) {
    return errJson("unauthorized", 401);
  }
  const result = await runReminderJob();
  return okJson(result);
});
