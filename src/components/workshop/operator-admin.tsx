"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";
import { addOperator, setOperatorActive } from "@/app/actions/workshop";
import { cn } from "@/lib/utils";

type Operator = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  joined: boolean;
};

export function AddOperatorForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("operator");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await addOperator(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(`${displayName} added`, { description: "They can now create an account with that email and sign in." });
      setEmail("");
      setDisplayName("");
      setRole("operator");
      router.refresh();
    } catch {
      setError("Couldn't add the operator. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit}>
      <HydratedFieldset aria-label="Add operator" className="grid gap-4 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="op-name">Name</Label>
          <Input id="op-name" name="displayName" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="op-email">Email</Label>
          <Input id="op-email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="op-role">Role</Label>
          <select
            id="op-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add"}
        </Button>
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-4">{error}</p>}
      </HydratedFieldset>
    </form>
  );
}

export function OperatorList({ operators, selfId }: { operators: Operator[]; selfId: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<Operator | null>(null);

  async function apply(op: Operator, active: boolean) {
    const result = await setOperatorActive(op.id, active);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(active ? `${op.displayName} reactivated` : `${op.displayName} deactivated`);
    router.refresh();
    return true;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {operators.map((op) => (
          <li key={op.id} className={cn("flex flex-wrap items-center justify-between gap-3 py-3", !op.isActive && "opacity-60")}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {op.displayName}
                {op.id === selfId && <span className="text-muted-foreground"> (you)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {op.email} · <span className="capitalize">{op.role}</span> ·{" "}
                {!op.isActive ? "Deactivated" : op.joined ? "Signed in" : "Hasn't signed in yet"}
              </p>
            </div>
            {op.id !== selfId &&
              (op.isActive ? (
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setTarget(op)}>
                  Deactivate
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => apply(op, true)}>
                  Reactivate
                </Button>
              ))}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Deactivate ${target?.displayName ?? "operator"}?`}
        description="They lose Workshop access at once, their agents disappear from every dashboard, and their agents' tokens stop being accepted. Nothing is deleted; reactivating restores it all."
        confirmLabel="Deactivate"
        onConfirm={() => (target ? apply(target, false) : false)}
      />
    </>
  );
}
