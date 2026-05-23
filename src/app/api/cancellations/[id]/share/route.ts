import { randomBytes } from "crypto";

import { getDbPool } from "@/lib/db";
import { ApiError } from "@/lib/server/api/api-error";
import { okJson } from "@/lib/server/api/json-response";
import { requireSession } from "@/lib/server/api/require-session";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { getRequestOrigin } from "@/lib/server/auth/app-origin";
import { logger } from "@/lib/server/logger";
import { signShareToken } from "@/lib/share/share-token";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function makeShareToken(): string {
  const payload = randomBytes(16).toString("base64url");
  return signShareToken(payload);
}

export const POST = withApiErrorHandling<Ctx>(async (req, ctx) => {
  const { user } = await requireSession();
  const { id } = await ctx.params;
  const pool = getDbPool();

  const existing = await pool.query<{ share_token: string | null }>(
    `SELECT share_token FROM "cancellation_entries"
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, user.id]
  );
  const current = existing.rows[0];
  if (!current) {
    throw new ApiError("not_found", 404);
  }

  let token = current.share_token;
  if (!token) {
    token = makeShareToken();
    await pool.query(
      `UPDATE "cancellation_entries"
         SET share_token = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [id, user.id, token]
    );
    logger.info("share_token_created", { user_id: user.id, id });
  }

  const origin = getRequestOrigin(req);
  return okJson({ share: { token, url: `${origin}/share/${token}` } });
});
