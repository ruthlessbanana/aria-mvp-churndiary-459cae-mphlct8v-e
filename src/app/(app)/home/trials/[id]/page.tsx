import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrialActions } from "@/features/churn-diary/components/trial-actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  service_name: string;
  trial_start_date: string;
  trial_conversion_date: string;
  notes: string | null;
  status: string;
  reminder_sent: boolean;
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr + "T00:00:00Z");
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default async function TrialDetailPage({
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
    `SELECT id, service_name, trial_start_date, trial_conversion_date, notes, status, reminder_sent
     FROM "trial_entries"
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, sess.user.id]
  );
  const row = rows[0];
  if (!row) notFound();

  const countdown = daysUntil(row.trial_conversion_date);

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
          <p className="text-sm text-muted-foreground">
            Converts {row.trial_conversion_date}
            {row.status === "active"
              ? ` • ${countdown >= 0 ? `${countdown} day${countdown === 1 ? "" : "s"} left` : "Past due"}`
              : ""}
          </p>
        </div>
        <Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">Trial started</p>
            <p className="text-muted-foreground">{row.trial_start_date}</p>
          </div>
          <div>
            <p className="font-medium">Reminder status</p>
            <p className="text-muted-foreground">
              {row.reminder_sent ? "Reminder email sent" : "Reminder not yet sent"}
            </p>
          </div>
          {row.notes ? (
            <div className="sm:col-span-2">
              <p className="font-medium">Notes</p>
              <p className="whitespace-pre-line text-muted-foreground">{row.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <TrialActions id={row.id} serviceName={row.service_name} status={row.status} />

      <div>
        <Link
          href={`/home/trials/${row.id}/edit`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Edit trial
        </Link>
      </div>
    </div>
  );
}
