import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Member } from "@/types";

interface OnlineMembersProps {
  members: Member[];
}

export function OnlineMembers({ members }: OnlineMembersProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Online Now
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one is in the House right now.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-1.5"
              >
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-gold/10 text-xs text-gold">
                      {member.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card bg-emerald-500" />
                </div>
                <span className="text-sm text-foreground">
                  {member.displayName}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
