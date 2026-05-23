"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type PrefsPayload = {
  ok: boolean;
  data?: {
    preferences?: { emailEnabled?: boolean; reminderDaysBefore?: number };
    emailEnabled?: boolean;
    reminderDaysBefore?: number;
  };
  error?: string;
  detail?: string;
};

export function NotificationPreferencesForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    emailEnabled: true,
    reminderDaysBefore: "7",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/notifications", {
          credentials: "include",
        });
        const json = (await res.json()) as PrefsPayload;
        if (!mounted) return;
        if (!res.ok || !json.ok) {
          toast.error("Could not load notification preferences");
          return;
        }
        const prefs = json.data?.preferences ?? json.data ?? {};
        setForm({
          emailEnabled: prefs.emailEnabled ?? true,
          reminderDaysBefore: String(prefs.reminderDaysBefore ?? 7),
        });
      } catch {
        if (mounted) toast.error("Could not load notification preferences");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const res = await fetch("/api/settings/notifications", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              emailEnabled: form.emailEnabled,
              reminderDaysBefore: Number(form.reminderDaysBefore),
            }),
          });
          const json = (await res.json()) as PrefsPayload;
          if (!res.ok || !json.ok) {
            toast.error(json.detail ?? json.error ?? "Failed to save preferences");
            return;
          }
          const prefs = json.data?.preferences ?? json.data ?? {};
          if (prefs.reminderDaysBefore !== undefined) {
            setForm((prev) => ({ ...prev, reminderDaysBefore: String(prefs.reminderDaysBefore) }));
          }
          toast.success("Preferences saved");
        } catch {
          toast.error("Failed to save preferences");
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        ChurnDiary checks your active trials every morning and emails you before each one converts.
      </p>

      <div className="flex items-start gap-3 rounded-md border p-3">
        <input
          id="emailEnabled"
          type="checkbox"
          checked={form.emailEnabled}
          onChange={(e) => setForm({ ...form, emailEnabled: e.target.checked })}
          disabled={loading || saving}
          className="mt-1"
        />
        <div>
          <label className="text-sm font-medium" htmlFor="emailEnabled">
            Send email reminders before trials convert
          </label>
          <p className="text-xs text-muted-foreground">
            Uncheck to pause every trial watchdog email.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="reminderDaysBefore">
          Days before conversion to send reminder *
        </label>
        <input
          id="reminderDaysBefore"
          type="number"
          min="0"
          max="60"
          required
          value={form.reminderDaysBefore}
          onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })}
          placeholder="7"
          disabled={loading || saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:max-w-xs"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
