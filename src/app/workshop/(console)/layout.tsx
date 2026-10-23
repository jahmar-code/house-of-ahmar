import { requirePageOperator } from "@/lib/workshop/access";
import { WorkshopShell } from "@/components/workshop/workshop-shell";

export default async function WorkshopConsoleLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageOperator();
  return (
    <WorkshopShell displayName={ctx.displayName} role={ctx.role}>
      {children}
    </WorkshopShell>
  );
}
