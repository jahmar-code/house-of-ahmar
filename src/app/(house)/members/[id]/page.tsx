import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { PRESENCE_TIMEOUT_MS } from "@/lib/constants";
import { Calendar, Mail, Phone, Clock } from "lucide-react";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Deactivated members are hidden everywhere else (directory, auth) — don't
  // leak their PII through the profile page either.
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, id), eq(members.isActive, true)),
  });
  if (!member) notFound();

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
                <AvatarFallback className="bg-secondary text-2xl text-foreground">
                  {member.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {online && (
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card bg-emerald-500" />
              )}
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
              {member.displayName}
            </h1>
            {member.fullName && member.fullName !== member.displayName && (
              <p className="text-sm text-muted-foreground">{member.fullName}</p>
            )}

            <Badge
              variant="outline"
              className={`mt-2 capitalize ${
                member.role === "elder"
                  ? "border-primary/30 bg-primary/10 text-primary"
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
    </div>
  );
}
