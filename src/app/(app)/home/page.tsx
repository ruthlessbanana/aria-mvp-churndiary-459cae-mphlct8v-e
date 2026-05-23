import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type CancellationRow = {
  id: string;
  service_name: string;
  cancel_date: string;
  monthly_cost_saved: string | null;
  reason: string;
  mood: number;
};

type TrialRow = {
  id: string;
  service_name: string;
  trial_conversion_date: string;
  status: string;
  reminder_sent: boolean;
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr + "T00:00:00Z");
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default async function HomePage() {
  const sess = await auth.api.getSession({ headers: await headers() });
  if (!sess?.user?.id) {
    redirect("/login");
  }
  const userId = sess.user.id;
  const pool = getDbPool();

  const [cancellationsRes, trialsRes, statsRes] = await Promise.all([
    pool.query<CancellationRow>(
      `SELECT id, service_name, cancel_date, monthly_cost_saved, reason, mood
       FROM "cancellation_entries"
       WHERE user_id = $1
       ORDER BY cancel_date DESC, created_at DESC
       LIMIT 50`,
      [userId]
    ),
    pool.query<TrialRow>(
      `SELECT id, service_name, trial_conversion_date, status, reminder_sent
       FROM "trial_entries"
       WHERE user_id = $1
       ORDER BY trial_conversion_date ASC, created_at DESC
       LIMIT 50`,
      [userId]
    ),
    pool.query<{
      cancellation_count: string;
      total_monthly_savings: string | null;
      active_trial_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM "cancellation_entries" WHERE user_id = $1) AS cancellation_count,
         (SELECT COALESCE(SUM(monthly_cost_saved), 0) FROM "cancellation_entries" WHERE user_id = $1) AS total_monthly_savings,
         (SELECT COUNT(*) FROM "trial_entries" WHERE user_id = $1 AND status = 'active') AS active_trial_count`,
      [userId]
    ),
  ]);

  const cancellations = cancellationsRes.rows;
  const trials = trialsRes.rows;
  const stats = statsRes.rows[0];

  const totalSavings = stats?.total_monthly_savings ? Number(stats.total_monthly_savings) : 0;
  const cancellationCount = stats?.cancellation_count ? Number(stats.cancellation_count) : 0;
  const activeTrialCount = stats?.active_trial_count ? Number(stats.active_trial_count) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your ChurnDiary</h1>
        <p className="text-sm text-muted-foreground">
          Track what you cancelled and watch free trials so you never get silently charged.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Personal stats">
        <Card>
          <CardHeader>
            <CardDescription>Cancellations logged</CardDescription>
            <CardTitle className="text-3xl">{cancellationCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total monthly savings</CardDescription>
            <CardTitle className="text-3xl">${totalSavings.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active trials watched</CardDescription>
            <CardTitle className="text-3xl">{activeTrialCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Cancellations</h2>
          <Link
            href="/home/cancellations/new"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            + Log Cancellation
          </Link>
        </div>
        {cancellations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing here yet — log your first cancellation to start your ledger.
              </p>
              <Link
                href="/home/cancellations/new"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                + Log Cancellation
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {cancellations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/home/cancellations/${c.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{c.service_name}</span>
                    <Badge variant="secondary">Mood {c.mood}/5</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Cancelled {c.cancel_date}</span>
                    <span>Reason: {c.reason}</span>
                    {c.monthly_cost_saved !== null ? (
                      <span>Saved ${Number(c.monthly_cost_saved).toFixed(2)}/mo</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Active Trials</h2>
          <Link
            href="/home/trials/new"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            + Add Trial
          </Link>
        </div>
        {trials.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No trials being watched. Add a trial so we can remind you before it converts.
              </p>
              <Link
                href="/home/trials/new"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                + Add Trial
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {trials.map((t) => {
              const days = daysUntil(t.trial_conversion_date);
              return (
                <li key={t.id}>
                  <Link
                    href={`/home/trials/${t.id}`}
                    className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{t.service_name}</span>
                      <Badge variant={t.status === "active" ? "default" : "secondary"}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Converts {t.trial_conversion_date}</span>
                      {t.status === "active" ? (
                        <span>
                          {days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : "Past due"}
                        </span>
                      ) : null}
                      {t.reminder_sent ? <span>Reminder sent</span> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
