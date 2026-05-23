import Link from "next/link";

import { NewTrialForm } from "@/features/churn-diary/components/new-trial-form";

export const dynamic = "force-dynamic";

export default function NewTrialPage() {
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/home" className="text-muted-foreground hover:underline">
          ← Back to Home
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add a Trial</h1>
        <p className="text-sm text-muted-foreground">
          ChurnDiary will email you a reminder before this trial converts.
        </p>
      </header>
      <NewTrialForm />
    </div>
  );
}
