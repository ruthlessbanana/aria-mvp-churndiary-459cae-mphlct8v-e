import Link from "next/link";

import { NewCancellationForm } from "@/features/churn-diary/components/new-cancellation-form";

export const dynamic = "force-dynamic";

export default function NewCancellationPage() {
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/home" className="text-muted-foreground hover:underline">
          ← Back to Home
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Log a Cancellation</h1>
        <p className="text-sm text-muted-foreground">
          Add a subscription you cancelled. We&apos;ll add it to your personal ledger.
        </p>
      </header>
      <NewCancellationForm />
    </div>
  );
}
