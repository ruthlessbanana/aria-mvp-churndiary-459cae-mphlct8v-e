import { z } from "zod";

import { getDbPool } from "@/lib/db";
import { ApiError } from "@/lib/server/api/api-error";
import { okJson } from "@/lib/server/api/json-response";
import { parseJsonBody } from "@/lib/server/api/parse-body";
import { requireSession } from "@/lib/server/api/require-session";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["active", "cancelled", "converted"]),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling<Ctx>(async (req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const body = await parseJsonBody(req, schema);

  const pool = getDbPool();
  const { rows } = await pool.query<{ id: string; status: string }>(
    `UPDATE "trial_entries"
        SET status = $3, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, status`,
    [id, user.id, body.status]
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", 404);
  }
  logger.info("trial_status_transition", {
    user_id: user.id,
    id: row.id,
    status: row.status,
  });
  return okJson({ trial: { id: row.id, status: row.status } });
});
