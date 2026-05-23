"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Initial = {
  serviceName: string;
  cancelDate: string;
  monthlyCostSaved: string;
  reason: string;
  reasonNotes: string;
  mood: string;
};

export function EditCancellationForm({ id, initial }: { id: string; initial: Initial }) {
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
          const res = await fetch(`/api/cancellations/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const json = (await res.json()) as {
            ok: boolean;
            data?: { cancellation?: { id: string } };
            error?: string;
            detail?: string;
          };
          if (!res.ok || !json.ok || !json.data?.cancellation) {
            toast.error(json.detail ?? json.error ?? "Failed to save changes");
            return;
          }
          toast.success("Saved");
          router.push(`/home/cancellations/${id}`);
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
        <label className="text-sm font-medium" htmlFor="cancelDate">Date Cancelled *</label>
        <input
          id="cancelDate"
          type="date"
          required
          value={form.cancelDate}
          onChange={(e) => setForm({ ...form, cancelDate: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="monthlyCostSaved">Monthly Cost Saved (USD)</label>
        <input
          id="monthlyCostSaved"
          type="number"
          step="0.01"
          min="0"
          value={form.monthlyCostSaved}
          onChange={(e) => setForm({ ...form, monthlyCostSaved: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="reason">Why did you leave? *</label>
        <select
          id="reason"
          required
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="price">price</option>
          <option value="quality">quality</option>
          <option value="unused">unused</option>
          <option value="found_better">found_better</option>
          <option value="other">other</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="reasonNotes">Any extra notes?</label>
        <textarea
          id="reasonNotes"
          rows={3}
          value={form.reasonNotes}
          onChange={(e) => setForm({ ...form, reasonNotes: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="mood">How did you feel about cancelling? *</label>
        <select
          id="mood"
          required
          value={form.mood}
          onChange={(e) => setForm({ ...form, mood: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
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
