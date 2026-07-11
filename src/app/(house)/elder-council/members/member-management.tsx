"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  updateMemberRole,
  deactivateMember,
  reactivateMember,
} from "@/app/actions/members";
import { toast } from "sonner";
import {
  MoreVertical,
  Shield,
  User,
  Eye,
  UserMinus,
  UserCheck,
} from "lucide-react";
import type { Member } from "@/types";
import type { HoaRole } from "@/lib/constants";

interface MemberManagementProps {
  members: Member[];
}

export function MemberManagement({ members }: MemberManagementProps) {
  async function handleRoleChange(memberId: string, role: HoaRole) {
    const result = await updateMemberRole(memberId, role);
    if (result.success) toast.success("Role updated");
    else toast.error(result.error);
  }

  async function handleDeactivate(memberId: string) {
    const result = await deactivateMember(memberId);
    if (result.success) toast.success("Member deactivated");
    else toast.error(result.error);
  }

  async function handleReactivate(memberId: string) {
    const result = await reactivateMember(memberId);
    if (result.success) toast.success("Member reactivated");
    else toast.error(result.error);
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <Card
          key={member.id}
          className={`border-border bg-card transition-colors hover:border-foreground/20 ${!member.isActive ? "opacity-60" : ""}`}
        >
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-secondary text-sm text-foreground">
                  {member.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {member.displayName}
                  </span>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] capitalize ${
                      member.role === "elder"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {member.role}
                  </Badge>
                  {!member.isActive && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${member.displayName}`}
                    className="h-8 w-8 shrink-0"
                  />
                }
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {member.isActive ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, "elder")}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Make Elder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, "member")}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, "guest")}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Make Guest
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeactivate(member.id)}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleReactivate(member.id)}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
