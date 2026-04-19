import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { MemberGrid } from "@/components/members/member-grid";

export default async function MembersPage() {
  const allMembers = await db.query.members.findMany({
    where: eq(members.isActive, true),
    orderBy: desc(members.lastSeenAt),
  });

  return (
    <div>
      <PageHeader
        title="The House"
        description={`${allMembers.length} member${allMembers.length !== 1 ? "s" : ""} of the House of Ahmar.`}
      />
      <MemberGrid members={allMembers} />
    </div>
  );
}
