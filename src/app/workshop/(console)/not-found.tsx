import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";

export default function WorkshopNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Nothing here"
      description="This page doesn't exist, or it hasn't been opened to you. Agents that are archived or not shared with you can't be found."
    >
      <Link href="/workshop" className={buttonVariants({ variant: "outline" })}>
        Back to agents
      </Link>
    </EmptyState>
  );
}
