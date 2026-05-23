"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TrialActions({
  id,
  serviceName,
  status,
}: {
  id: string;
  serviceName: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function transition(target: "cancelled" | "converted") {
    setBusy(target);
    try {
      const res = await fetch(`/api/trials/${id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { trial?: { id: string; status: string } };
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.data?.trial) {
        toast.error(json.detail ?? json.error ?? "Failed to update trial");
        return;
      }
      toast.success(`Marked as ${target}`);
      router.refresh();
    } catch {
      toast.error("Failed to update trial");
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    setBusy("delete");
    try {
      const res = await fetch(`/api/trials/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { id?: string };
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error(json.detail ?? json.error ?? "Failed to delete");
        return;
      }
      toast.success(`Deleted ${serviceName}`);
      router.push("/home");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => transition("cancelled")}
            disabled={busy !== null}
          >
            {busy === "cancelled" ? "Updating…" : "Mark as Cancelled"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => transition("converted")}
            disabled={busy !== null}
          >
            {busy === "converted" ? "Updating…" : "Mark as Converted"}
          </Button>
        </>
      ) : null}
      <Button type="button" variant="outline" render={<Link href={`/home/trials/${id}/edit`} />}>
        Edit
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="destructive">
              Delete
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trial?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes &ldquo;{serviceName}&rdquo; from your trial watch list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={busy === "delete"}>
              {busy === "delete" ? "Deleting…" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
