"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import {
  archiveInvestmentAccount,
  renameInvestmentAccount,
} from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvestmentAccountActions({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await renameInvestmentAccount(id, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleArchive() {
    if (!confirm("Archive this account? Its history will remain readable.")) return;
    setPending(true);
    const result = await archiveInvestmentAccount(id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push("/portfolio");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage investment account</DialogTitle>
          <DialogDescription>
            Rename the account or archive it while retaining all history.
          </DialogDescription>
        </DialogHeader>
        <form action={handleRename} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`rename-${id}`}>Account name</Label>
            <Input id={`rename-${id}`} name="name" defaultValue={name} required />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleArchive}
              disabled={pending}
            >
              <Archive />
              Archive
            </Button>
            <Button className="flex-1" disabled={pending}>
              {pending ? "Saving..." : "Save name"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
