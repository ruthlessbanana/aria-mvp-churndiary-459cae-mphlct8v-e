import crypto from "crypto";

const SECRET =
  process.env.SHARE_TOKEN_HMAC_SECRET ??
  "dev-only-share-token-hmac-secret-please-set-SHARE_TOKEN_HMAC_SECRET";

function computeHmac(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function signShareToken(payload: string): string {
  return `${payload}.${computeHmac(payload)}`;
}

export function verifyShareToken(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === token.length - 1) return null;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = computeHmac(payload);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  return payload;
}
