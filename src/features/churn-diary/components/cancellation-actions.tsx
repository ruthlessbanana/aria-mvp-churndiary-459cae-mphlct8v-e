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

export function CancellationActions({
  id,
  serviceName,
}: {
  id: string;
  serviceName: string;
}) {
  const router = useRouter();
  const [copyLoading, setCopyLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function onCopyShareLink() {
    setCopyLoading(true);
    try {
      const res = await fetch(`/api/cancellations/${id}/share`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { share?: { token: string; url: string } };
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.data?.share) {
        toast.error(json.detail ?? json.error ?? "Failed to create share link");
        return;
      }
      const url = json.data.share.url;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard");
      } catch {
        toast.success(`Share link: ${url}`);
      }
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setCopyLoading(false);
    }
  }

  async function onDelete() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/cancellations/${id}`, {
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
      setDeleteLoading(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={onCopyShareLink} disabled={copyLoading}>
        {copyLoading ? "Copying…" : "Copy share link"}
      </Button>
      <Button type="button" variant="outline" render={<Link href={`/home/cancellations/${id}/edit`} />}>
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
            <AlertDialogTitle>Delete this cancellation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes &ldquo;{serviceName}&rdquo; from your diary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting…" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
