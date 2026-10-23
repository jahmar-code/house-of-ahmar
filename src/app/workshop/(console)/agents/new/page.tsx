import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CreateAgentForm } from "@/components/workshop/create-agent-form";
import { requirePageOperator } from "@/lib/workshop/access";
import { getRequestOrigin } from "@/lib/workshop/origin";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage() {
  await requirePageOperator();
  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Agents"
        title="Register an agent"
        description="Each agent gets its own token. Agents push status to the Workshop; the Workshop never connects to them."
      />
      <CreateAgentForm ingestOrigin={await getRequestOrigin()} />
    </div>
  );
}
