import Link from "next/link";
import { notFound } from "next/navigation";

import { getDbPool } from "@/lib/db";
import { verifyShareToken } from "@/lib/share/share-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Entry = {
  id: string;
  service_name: string;
  cancel_date: string;
  reason: string;
  reason_notes: string | null;
  mood: number;
};

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!verifyShareToken(token)) {
    notFound();
  }
  const pool = getDbPool();
  const ownerRes = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM "cancellation_entries" WHERE share_token = $1 LIMIT 1`,
    [token]
  );
  const ownerRow = ownerRes.rows[0];

  if (!ownerRow) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Diary not found</h1>
        <p className="text-sm text-muted-foreground">
          This share link is invalid or has been removed.
        </p>
        <Link
          href="/"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Go home
        </Link>
      </main>
    );
  }

  const [entriesRes, ownerInfoRes] = await Promise.all([
    pool.query<Entry>(
      `SELECT id, service_name, cancel_date, reason, reason_notes, mood
       FROM "cancellation_entries"
       WHERE user_id = $1
       ORDER BY cancel_date DESC, created_at DESC`,
      [ownerRow.user_id]
    ),
    pool.query<{ name: string | null }>(
      `SELECT name FROM "user" WHERE id = $1 LIMIT 1`,
      [ownerRow.user_id]
    ),
  ]);

  const entries = entriesRes.rows;
  const ownerName = ownerInfoRes.rows[0]?.name ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ownerName ? `${ownerName}'s Cancellation Diary` : "Cancellation Diary"}
        </h1>
        <p className="text-sm text-muted-foreground">
          A public look at the subscriptions someone said goodbye to.
        </p>
      </header>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No cancellations to show yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{entry.service_name}</CardTitle>
                    <Badge variant="secondary">Mood {entry.mood}/5</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>Cancelled on {entry.cancel_date}</p>
                  <p>Reason: {entry.reason}</p>
                  {entry.reason_notes ? (
                    <p className="whitespace-pre-line">{entry.reason_notes}</p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <footer className="border-t pt-4 text-center text-sm text-muted-foreground">
        Build your own diary —{" "}
        <Link href="/auth/sign-up" className="text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </footer>
    </main>
  );
}
