import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AddOperatorForm, OperatorList } from "@/components/workshop/operator-admin";
import { requirePageOperator } from "@/lib/workshop/access";
import { listOperators } from "@/lib/workshop/queries";

export const metadata: Metadata = { title: "Operators" };
export const dynamic = "force-dynamic";

export default async function OperatorsPage() {
  const ctx = await requirePageOperator();
  if (ctx.role !== "admin") notFound();
  const operators = await listOperators();

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Admin"
        title="Operators"
        description="People who can use the Workshop. Adding someone here doesn't make them family and grants nothing in the House. Each operator sees only their own agents and the ones shared with them, admins included."
      />
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Add an operator</h2>
        <AddOperatorForm />
        <p className="mt-3 text-xs text-muted-foreground">
          They then create an account with this exact email at <span className="font-mono">/workshop/sign-up</span> and
          confirm it. Access starts on their first confirmed sign-in.
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-card px-5 py-2">
        <h2 className="sr-only">All operators</h2>
        <OperatorList operators={operators} selfId={ctx.operatorId} />
      </section>
    </div>
  );
}
