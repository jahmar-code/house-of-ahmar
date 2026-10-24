"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";
import { createAgent } from "@/app/actions/workshop";
import { TokenReveal } from "./token-reveal";

export function CreateAgentForm({ ingestOrigin }: { ingestOrigin: string }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ id: string; token: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await createAgent(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCreated(result.data ?? null);
    } catch {
      setError("Couldn't create the agent. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-5">
        <p role="status" className="text-sm text-foreground">
          <span className="font-semibold">{name}</span> is registered. It will appear as “Not connected” until its first heartbeat.
        </p>
        <TokenReveal token={created.token} ingestOrigin={ingestOrigin} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/workshop/agents/${created.id}`} className={buttonVariants()}>
            I&apos;ve saved the token — open the agent
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/workshop/connect" className={buttonVariants({ variant: "outline" })}>
            Integration guide
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <HydratedFieldset aria-label="New agent" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lead triage bot"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "agent-error" : undefined}
            className="h-11 bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="agent-description"
            name="description"
            maxLength={500}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What it does and where it runs"
            className="bg-card"
          />
        </div>
        {error && (
          <p id="agent-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Creating..." : "Create agent and issue token"}
        </Button>
      </HydratedFieldset>
    </form>
  );
}
