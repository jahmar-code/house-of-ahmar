import { KeyRound } from "lucide-react";
import { CodeBlock } from "./code-block";

/** A freshly issued token. It exists only in this render; reloading loses it by design. */
export function TokenReveal({ token, ingestOrigin }: { token: string; ingestOrigin: string }) {
  return (
    <div className="space-y-4 rounded-2xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">Copy this token now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It is shown once and stored only as a hash. Put it in the agent&apos;s environment as{" "}
            <code className="font-mono text-foreground">HOA_AGENT_TOKEN</code>. Lost it? Rotate a new one from the agent page.
          </p>
        </div>
      </div>
      <CodeBlock code={token} label="Agent token" />
      <CodeBlock
        label="Send a first heartbeat"
        code={`curl -X POST ${ingestOrigin}/api/agents/v1/heartbeat \\
  -H "Authorization: Bearer $HOA_AGENT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"running","message":"Hello from my agent"}'`}
      />
    </div>
  );
}
