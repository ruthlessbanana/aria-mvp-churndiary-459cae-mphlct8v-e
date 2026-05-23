import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { EditCancellationForm } from "@/features/churn-diary/components/edit-cancellation-form";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  service_name: string;
  cancel_date: string;
  monthly_cost_saved: string | null;
  reason: string;
  reason_notes: string | null;
  mood: number;
};

export default async function EditCancellationPage({
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
    `SELECT id, service_name, cancel_date, monthly_cost_saved, reason, reason_notes, mood
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
        <Link
          href={`/home/cancellations/${row.id}`}
          className="text-muted-foreground hover:underline"
        >
          ← Back to cancellation
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Cancellation</h1>
      </header>
      <EditCancellationForm
        id={row.id}
        initial={{
          serviceName: row.service_name,
          cancelDate: row.cancel_date,
          monthlyCostSaved: row.monthly_cost_saved !== null ? String(Number(row.monthly_cost_saved)) : "",
          reason: row.reason,
          reasonNotes: row.reason_notes ?? "",
          mood: String(row.mood),
        }}
      />
    </div>
  );
}
