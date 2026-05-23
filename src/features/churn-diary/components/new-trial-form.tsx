"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function NewTrialForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    serviceName: "",
    trialStartDate: "",
    trialConversionDate: "",
    notes: "",
  });

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          const res = await fetch("/api/trials", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const json = (await res.json()) as {
            ok: boolean;
            data?: { trial?: { id: string } };
            error?: string;
            detail?: string;
          };
          if (!res.ok || !json.ok || !json.data?.trial) {
            toast.error(json.detail ?? json.error ?? "Failed to add trial");
            return;
          }
          toast.success("Trial added");
          router.push(`/home/trials/${json.data.trial.id}`);
          router.refresh();
        } catch {
          toast.error("Failed to add trial");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="serviceName">Service Name *</label>
        <input
          id="serviceName"
          required
          value={form.serviceName}
          onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
          placeholder="e.g. Hulu, Duolingo Plus"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="trialStartDate">Trial Start Date *</label>
        <input
          id="trialStartDate"
          type="date"
          required
          value={form.trialStartDate}
          onChange={(e) => setForm({ ...form, trialStartDate: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="trialConversionDate">Trial Converts On *</label>
        <input
          id="trialConversionDate"
          type="date"
          required
          value={form.trialConversionDate}
          onChange={(e) => setForm({ ...form, trialConversionDate: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional reminders for yourself…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Add Trial"}
        </Button>
      </div>
    </form>
  );
}
