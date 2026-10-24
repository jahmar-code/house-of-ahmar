"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { archiveAgent, rotateAgentToken, updateAgent } from "@/app/actions/workshop";
import { TokenReveal } from "./token-reveal";

export function AgentSettings({
  agentId,
  name: initialName,
  description: initialDescription,
  tokenHint,
  ingestOrigin,
}: {
  agentId: string;
  name: string;
  description: string | null;
  tokenHint: string;
  ingestOrigin: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function save(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const result = await updateAgent(agentId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function rotate() {
    const result = await rotateAgentToken(agentId);
    if (!result.success || !result.data) {
      toast.error(result.success ? "Couldn't rotate the token" : result.error);
      return false;
    }
    setNewToken(result.data.token);
    router.refresh();
    return true;
  }

  async function archive() {
    const result = await archiveAgent(agentId);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success("Agent archived");
    router.push("/workshop");
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-8">
      <form action={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea
            id="settings-description"
            name="description"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-background"
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? "Saving..." : "Save details"}
        </Button>
      </form>

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Token</h3>
        <p className="text-sm text-muted-foreground">
          Current token <code className="font-mono text-foreground">{tokenHint}</code>. Rotating cuts off the old token
          immediately.
        </p>
        {newToken ? (
          <TokenReveal token={newToken} ingestOrigin={ingestOrigin} />
        ) : (
          <Button variant="outline" onClick={() => setConfirmRotate(true)}>
            <KeyRound className="size-4" aria-hidden="true" />
            Rotate token
          </Button>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Archive</h3>
        <p className="text-sm text-muted-foreground">
          Removes the agent from every dashboard and rejects its token. History is kept.
        </p>
        <Button variant="outline" className="text-destructive" onClick={() => setConfirmArchive(true)}>
          <Archive className="size-4" aria-hidden="true" />
          Archive agent
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Rotate this token?"
        description="The running agent will be rejected until you give it the new token."
        confirmLabel="Rotate token"
        onConfirm={rotate}
      />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this agent?"
        description="It disappears for you and everyone it's shared with, and its token stops working."
        confirmLabel="Archive"
        onConfirm={archive}
      />
    </div>
  );
}
