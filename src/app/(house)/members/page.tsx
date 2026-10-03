import { db } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth";
import { members } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getHouseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { MemberGrid } from "@/components/members/member-grid";

export default async function MembersPage() {
  await requirePageAuth();
  const [allMembers, settings] = await Promise.all([
    db.query.members.findMany({
      where: eq(members.isActive, true),
      // The directory needs a face, name, role, biography and presence only.
      // Keep contact details and Auth identifiers out of this read model.
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        bio: true,
        lastSeenAt: true,
      },
      // DESC defaults to NULLS FIRST in Postgres, which floated relatives who have
      // never signed in to the top of the family directory. Recently-seen first.
      orderBy: sql`${members.lastSeenAt} desc nulls last`,
    }),
    getHouseSettings(),
  ]);

  return (
    <div>
      {/* Title matches the nav label exactly. "The House" is reserved for the
          whole place — it cannot also mean the people list. */}
      <PageHeader
        title="Our People"
        description={`${allMembers.length} ${allMembers.length === 1 ? "person" : "people"} in ${settings.houseName}.`}
      />
      <MemberGrid members={allMembers} />
    </div>
  );
}
