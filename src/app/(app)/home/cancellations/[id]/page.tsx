import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CancellationActions } from "@/features/churn-diary/components/cancellation-actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  service_name: string;
  cancel_date: string;
  monthly_cost_saved: string | null;
  reason: string;
  reason_notes: string | null;
  mood: number;
  share_token: string | null;
};

export default async function CancellationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sess = await auth.api.getSession({ headers: await headers() });
  if (!sess?.user?.id) {
    redirect("/login");
  }
  const pool = getDbPool();
  const { rows } = await pool.query<Row>(
    `SELECT id, service_name, cancel_date, monthly_cost_saved, reason, reason_notes, mood, share_token
     FROM "cancellation_entries"
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, sess.user.id]
  );
  const row = rows[0];
  if (!row) notFound();

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/home" className="text-muted-foreground hover:underline">
          ← Back to Home
        </Link>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{row.service_name}</h1>
          <p className="text-sm text-muted-foreground">Cancelled on {row.cancel_date}</p>
        </div>
        <Badge variant="secondary">Mood {row.mood}/5</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">Reason</p>
            <p className="text-muted-foreground">{row.reason}</p>
          </div>
          <div>
            <p className="font-medium">Monthly cost saved</p>
            <p className="text-muted-foreground">
              {row.monthly_cost_saved !== null
                ? `$${Number(row.monthly_cost_saved).toFixed(2)}`
                : "—"}
            </p>
          </div>
          {row.reason_notes ? (
            <div className="sm:col-span-2">
              <p className="font-medium">Notes</p>
              <p className="whitespace-pre-line text-muted-foreground">{row.reason_notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CancellationActions id={row.id} serviceName={row.service_name} />

      <div>
        <Link
          href={`/home/cancellations/${row.id}/edit`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Edit cancellation
        </Link>
      </div>
    </div>
  );
}
