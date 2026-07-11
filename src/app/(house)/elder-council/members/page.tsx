import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { MemberManagement } from "./member-management";

export default async function ManageMembersPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const allMembers = await db.query.members.findMany({
    orderBy: desc(members.createdAt),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Elder Council"
        title="Manage Members"
        description="View and manage House members."
      />
      <MemberManagement members={allMembers} />
    </div>
  );
}
