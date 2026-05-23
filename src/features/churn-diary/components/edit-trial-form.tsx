"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Initial = {
  serviceName: string;
  trialStartDate: string;
  trialConversionDate: string;
  notes: string;
  status: string;
};

export function EditTrialForm({ id, initial }: { id: string; initial: Initial }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...initial });

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          const res = await fetch(`/api/trials/${id}`, {
            method: "PATCH",
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
            toast.error(json.detail ?? json.error ?? "Failed to save changes");
            return;
          }
          toast.success("Saved");
          router.push(`/home/trials/${id}`);
          router.refresh();
        } catch {
          toast.error("Failed to save changes");
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
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="status">Status *</label>
        <select
          id="status"
          required
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="active">active</option>
          <option value="cancelled">cancelled</option>
          <option value="converted">converted</option>
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
