import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, differenceInDays, setYear } from "date-fns";
import type { Member } from "@/types";

interface UpcomingBirthdaysProps {
  members: Member[];
}

export function UpcomingBirthdays({ members }: UpcomingBirthdaysProps) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const upcoming = members
    .filter((m) => m.birthday)
    .map((m) => {
      const bday = new Date(m.birthday!);
      let nextBirthday = setYear(bday, currentYear);
      if (nextBirthday < now) {
        nextBirthday = setYear(bday, currentYear + 1);
      }
      return { member: m, nextBirthday, daysUntil: differenceInDays(nextBirthday, now) };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">
          Upcoming Birthdays
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No birthdays on record.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(({ member, nextBirthday, daysUntil }) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 p-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-gold/10 text-xs text-gold">
                    {member.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {member.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(nextBirthday, "MMM d")}
                  </p>
                </div>
                <span className="text-xs font-medium text-gold">
                  {daysUntil === 0
                    ? "Today!"
                    : daysUntil === 1
                      ? "Tomorrow"
                      : `${daysUntil} days`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
