import { db } from "@/lib/db";
import { members, memberRelationships } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FamilyTree } from "@/components/family/family-tree";
import { RelationshipEditor } from "@/components/family/relationship-editor";
import { TreePine } from "lucide-react";

export default async function FamilyPage() {
  const ctx = await getAuthContext();

  const [allMembers, edges] = await Promise.all([
    db.query.members.findMany({ orderBy: asc(members.displayName) }),
    db.query.memberRelationships.findMany({
      orderBy: asc(memberRelationships.createdAt),
    }),
  ]);

  const isElder = ctx?.role === "elder";
  const hasAnyEdges = edges.length > 0;

  return (
    <div>
      <PageHeader
        title="Family Tree"
        description="The lineage of the House — eldest on the right, descendants spread to the left."
      >
        {isElder && <RelationshipEditor members={allMembers} />}
      </PageHeader>

      {allMembers.length === 0 ? (
        <EmptyState
          icon={TreePine}
          title="No members yet"
          description="The House awaits its first elder."
        />
      ) : !hasAnyEdges ? (
        <div className="space-y-4">
          <EmptyState
            icon={TreePine}
            title="No relationships recorded"
            description={
              isElder
                ? "Tap “Add relationship” above to connect parents and children."
                : "An elder hasn't drawn the family tree yet."
            }
          />
          {/* Even with no edges, render the layout so members appear as a single generation */}
          <FamilyTree
            members={allMembers}
            edges={[]}
            focusMemberId={ctx?.memberId}
          />
        </div>
      ) : (
        <FamilyTree
          members={allMembers}
          edges={edges.map((e) => ({ parentId: e.parentId, childId: e.childId }))}
          focusMemberId={ctx?.memberId}
        />
      )}
    </div>
  );
}
