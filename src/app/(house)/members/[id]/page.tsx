import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { members, memberRelationships } from "@/lib/db/schema";
import { asc, eq, or } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { PRESENCE_TIMEOUT_MS } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { RelationshipEditor } from "@/components/family/relationship-editor";
import { RemoveRelationshipButton } from "@/components/family/remove-relationship-button";
import { Calendar, Mail, Phone, Clock, Users } from "lucide-react";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAuthContext();

  const member = await db.query.members.findFirst({
    where: eq(members.id, id),
  });
  if (!member) notFound();

  // Pull every relationship that touches this member, plus the full member list
  // (used by the editor for elders).
  const [relationshipsTouching, allMembers] = await Promise.all([
    db.query.memberRelationships.findMany({
      where: or(
        eq(memberRelationships.parentId, id),
        eq(memberRelationships.childId, id)
      ),
    }),
    db.query.members.findMany({ orderBy: asc(members.displayName) }),
  ]);

  const memberMap = new Map(allMembers.map((m) => [m.id, m] as const));

  const parentEdges = relationshipsTouching.filter((r) => r.childId === id);
  const childEdges = relationshipsTouching.filter((r) => r.parentId === id);
  const isElder = ctx?.role === "elder";

  const online =
    member.lastSeenAt &&
    new Date().getTime() - new Date(member.lastSeenAt).getTime() <
      PRESENCE_TIMEOUT_MS;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-border bg-card">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-gold/10 text-2xl text-gold">
                  {member.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {online && (
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card bg-emerald-500" />
              )}
            </div>

            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
              {member.displayName}
            </h1>
            {member.fullName && member.fullName !== member.displayName && (
              <p className="text-sm text-muted-foreground">{member.fullName}</p>
            )}

            <Badge
              variant="outline"
              className={`mt-2 capitalize ${
                member.role === "elder"
                  ? "border-gold/30 text-gold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {member.role}
            </Badge>

            {member.bio && (
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                {member.bio}
              </p>
            )}
          </div>

          <div className="mt-8 space-y-3">
            {member.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{member.email}</span>
              </div>
            )}
            {member.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{member.phone}</span>
              </div>
            )}
            {member.birthday && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">
                  {format(new Date(member.birthday), "MMMM d")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Member since {format(new Date(member.createdAt), "MMMM yyyy")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" />
              <h2 className="font-heading text-lg text-foreground">
                Family
              </h2>
            </div>
            {isElder && (
              <RelationshipEditor
                members={allMembers}
                defaultChildId={id}
                triggerLabel="Add parent"
              />
            )}
          </div>

          <RelationshipList
            heading={`Parents (${parentEdges.length})`}
            emptyText="No parents recorded."
            people={parentEdges.map((e) => ({
              edge: { parentId: e.parentId, childId: e.childId },
              other: memberMap.get(e.parentId),
            }))}
            isElder={isElder}
          />

          <RelationshipList
            heading={`Children (${childEdges.length})`}
            emptyText="No children recorded."
            people={childEdges.map((e) => ({
              edge: { parentId: e.parentId, childId: e.childId },
              other: memberMap.get(e.childId),
            }))}
            isElder={isElder}
          />

          {isElder && childEdges.length === 0 && parentEdges.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Tip — use the “Add parent” button above to record this person’s
              parent. To add a child instead, open the child’s profile.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface RelationshipRow {
  edge: { parentId: string; childId: string };
  other: { id: string; displayName: string; avatarUrl: string | null } | undefined;
}

function RelationshipList({
  heading,
  emptyText,
  people,
  isElder,
}: {
  heading: string;
  emptyText: string;
  people: RelationshipRow[];
  isElder: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {heading}
      </p>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {people.map(({ edge, other }) => (
            <li
              key={`${edge.parentId}-${edge.childId}`}
              className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
            >
              {other ? (
                <Link
                  href={`/members/${other.id}`}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-gold"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={other.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-gold/10 text-xs text-gold">
                      {other.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{other.displayName}</span>
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  Unknown member
                </span>
              )}
              {isElder && (
                <RemoveRelationshipButton
                  parentId={edge.parentId}
                  childId={edge.childId}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
