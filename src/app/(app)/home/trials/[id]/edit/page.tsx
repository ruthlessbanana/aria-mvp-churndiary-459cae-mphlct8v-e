import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { EditTrialForm } from "@/features/churn-diary/components/edit-trial-form";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  service_name: string;
  trial_start_date: string;
  trial_conversion_date: string;
  notes: string | null;
  status: string;
};

export default async function EditTrialPage({
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
    `SELECT id, service_name, trial_start_date, trial_conversion_date, notes, status
     FROM "trial_entries"
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, sess.user.id]
  );
  const row = rows[0];
  if (!row) notFound();

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={`/home/trials/${row.id}`} className="text-muted-foreground hover:underline">
          ← Back to trial
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Trial</h1>
      </header>
      <EditTrialForm
        id={row.id}
        initial={{
          serviceName: row.service_name,
          trialStartDate: row.trial_start_date,
          trialConversionDate: row.trial_conversion_date,
          notes: row.notes ?? "",
          status: row.status,
        }}
      />
    </div>
  );
}
