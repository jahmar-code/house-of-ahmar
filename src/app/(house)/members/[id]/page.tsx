import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { members, posts, rsvps } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  format,
  formatDistanceToNow,
  differenceInCalendarDays,
  startOfToday,
} from "date-fns";
import { PRESENCE_TIMEOUT_MS } from "@/lib/constants";
import {
  ArrowLeft,
  Cake,
  Calendar,
  Mail,
  Phone,
  Pencil,
  Home,
} from "lucide-react";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `members.birthday` is a 'YYYY-MM-DD' string. Build a LOCAL calendar date from
 * its parts — never `new Date(str)`, which parses as UTC midnight and lands a
 * day early in negative-UTC zones. Same approach as the Great Hall's birthday
 * card, so the two surfaces agree.
 */
function birthdayLabel(birthday: string): { date: string; when: string | null } {
  const today = startOfToday();
  const [, mo, d] = birthday.split("-").map(Number);
  let next = new Date(today.getFullYear(), mo - 1, d);
  if (differenceInCalendarDays(next, today) < 0) {
    next = new Date(today.getFullYear() + 1, mo - 1, d);
  }
  const daysUntil = differenceInCalendarDays(next, today);
  return {
    date: format(next, "MMMM d"),
    when:
      daysUntil === 0
        ? "Today"
        : daysUntil === 1
          ? "Tomorrow"
          : daysUntil <= 30
            ? `in ${daysUntil} days`
            : null,
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePageAuth();
  const { id } = await params;
  // A stale or mistyped link is a 404, not a Postgres uuid cast error.
  if (!UUID_RE.test(id)) notFound();

  // Deactivated members are hidden everywhere else (directory, auth) — don't
  // leak their PII through the profile page either.
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, id), eq(members.isActive, true)),
  });
  if (!member) notFound();

  const [recentPosts, attending] = await Promise.all([
    db.query.posts.findMany({
      where: and(eq(posts.authorId, member.id), eq(posts.isDeleted, false)),
      orderBy: desc(posts.createdAt),
      limit: 3,
    }),
    db.query.rsvps.findMany({
      where: and(eq(rsvps.memberId, member.id), eq(rsvps.status, "attending")),
      with: { gathering: true },
    }),
  ]);

  const now = new Date();
  const upcoming = attending
    .flatMap((r) => (r.gathering ? [r.gathering] : []))
    .filter(
      (g) => !g.isCancelled && !g.archivedAt && new Date(g.endsAt ?? g.startsAt) >= now
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    .slice(0, 3);

  const online =
    member.lastSeenAt &&
    now.getTime() - new Date(member.lastSeenAt).getTime() < PRESENCE_TIMEOUT_MS;

  const isSelf = ctx?.memberId === member.id;
  // Contact details are for the family, not for someone with limited standing.
  const canSeeContact = ctx !== null && (isSelf || ctx.role !== "guest");
  const birthday = member.birthday ? birthdayLabel(member.birthday) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/members"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Our People
      </Link>

      <Card className="border-border bg-card">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24">
              <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-secondary text-2xl text-foreground">
                {member.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-foreground">
              {member.displayName}
            </h1>
            {member.fullName && member.fullName !== member.displayName && (
              <p className="text-sm text-muted-foreground">{member.fullName}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Badge
                variant="outline"
                className={`capitalize ${
                  member.role === "elder"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {member.role}
              </Badge>
              {online && (
                <Badge
                  variant="outline"
                  className="border-success/30 bg-success/10 text-success"
                >
                  Online now
                </Badge>
              )}
            </div>

            {member.bio && (
              <p className="mt-4 max-w-md text-sm text-foreground/80">
                {member.bio}
              </p>
            )}

            {isSelf && (
              <Button
                variant="outline"
                className="mt-5 h-11 px-5"
                render={<Link href="/settings" />}
              >
                <Pencil className="h-4 w-4" />
                Edit your profile
              </Button>
            )}
          </div>

          <div className="mt-8 space-y-3 border-t border-border pt-6">
            {birthday && (
              <div className="flex items-center gap-3 text-sm">
                <Cake className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-foreground">
                  Birthday — {birthday.date}
                </span>
                {birthday.when && (
                  <span className="text-xs font-medium text-primary">
                    {birthday.when}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">
                In the House since{" "}
                {format(new Date(member.createdAt), "MMMM yyyy")}
              </span>
            </div>

            {canSeeContact && member.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`mailto:${member.email}`}
                  className="min-w-0 truncate rounded-lg text-foreground underline underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {member.email}
                </a>
              </div>
            )}
            {canSeeContact && member.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`tel:${member.phone}`}
                  className="rounded-lg text-foreground underline underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {member.phone}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Recent on The Wall
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isSelf
                ? "You haven't written on The Wall yet."
                : `${member.displayName} hasn't written on The Wall yet.`}
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href="/feed"
                  className="block rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:border-foreground/20 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <p className="text-sm text-foreground/80 line-clamp-2">
                    {post.content}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">
            Coming up
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isSelf
                ? "You're not down for any gatherings yet."
                : `${member.displayName} isn't down for any gatherings yet.`}
            </p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((gathering) => (
                <Link
                  key={gathering.id}
                  href={`/gatherings/${gathering.id}`}
                  className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:border-foreground/20 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {gathering.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(gathering.startsAt), "EEEE, MMMM d")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
