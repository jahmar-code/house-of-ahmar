"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { ROLE_HIERARCHY } from "@/lib/constants";
import type { Member } from "@/types";
import type { HoaRole } from "@/lib/constants";

interface MemberManagementProps {
  members: Member[];
}

/** What the confirmation dialog is currently asking about. */
interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  run: () => Promise<boolean>;
}

const roleItems: { role: HoaRole; label: string; Icon: typeof Shield }[] = [
  { role: "elder", label: "Make Elder", Icon: Shield },
  { role: "member", label: "Make Member", Icon: User },
  { role: "guest", label: "Make Guest", Icon: Eye },
];

export function MemberManagement({ members }: MemberManagementProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null);
  const [pending, startTransition] = useTransition();

  async function applyRoleChange(memberId: string, role: HoaRole) {
    const result = await updateMemberRole(memberId, role);
    if (result.success) {
      toast.success("Role updated");
      router.refresh();
    } else toast.error(result.error);
    return result.success;
  }

  async function applyDeactivate(memberId: string) {
    const result = await deactivateMember(memberId);
    if (result.success) {
      toast.success("Removed from the House");
      router.refresh();
    } else toast.error(result.error);
    return result.success;
  }

  function handleReactivate(memberId: string) {
    startTransition(async () => {
      try {
        const result = await reactivateMember(memberId);
        if (result.success) {
          toast.success("Welcomed back");
          router.refresh();
        } else toast.error(result.error);
      } catch {
        toast.error("Couldn't welcome them back. Please try again.");
      }
    });
  }

  // Nothing that changes a relative's standing happens on one tap. Every branch
  // names the person and says, in plain words, what it does to them.
  function confirmRoleChange(member: Member, role: HoaRole) {
    const name = member.displayName;
    const description =
      role === "elder"
        ? `Elders can mint invite codes, change anyone's role, and remove people from the House. ${name} will be able to do all of that.`
        : role === "guest"
          ? `${name} will still see the House and can still answer gathering invites, but won't be able to post, comment or write in the Council.`
          : `${name} will keep full access to the House, but will no longer be able to mint invite codes, change roles or open chambers.`;

    setConfirming({
      title:
        role === "elder"
          ? `Make ${name} an Elder?`
          : `Make ${name} a ${role === "guest" ? "Guest" : "Member"}?`,
      description,
      confirmLabel: role === "elder" ? `Make ${name} an Elder` : "Change role",
      // Only a step down is destructive; a promotion still asks, but calmly.
      destructive: ROLE_HIERARCHY[role] < ROLE_HIERARCHY[member.role],
      run: () => applyRoleChange(member.id, role),
    });
  }

  function confirmDeactivate(member: Member) {
    const name = member.displayName;
    setConfirming({
      title: `Remove ${name} from the House?`,
      description: `${name} will be signed out and won't be able to get back in until you bring them back. Their posts, comments and photos all stay.`,
      confirmLabel: `Remove ${name}`,
      destructive: true,
      run: () => applyDeactivate(member.id),
    });
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <Card
          key={member.id}
          className={`border-border bg-card transition-colors hover:border-foreground/20 ${!member.isActive ? "opacity-70" : ""}`}
        >
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
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
                    // Icon + word, not a red tint — the tinted red on its own
                    // is below the contrast floor at this size.
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 border-destructive/40 text-[10px] text-foreground"
                    >
                      <UserMinus className="h-2.5 w-2.5" />
                      Removed
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
                    className="size-11 shrink-0"
                  />
                }
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {member.isActive ? (
                  <>
                    {roleItems
                      .filter(({ role }) => role !== member.role)
                      .map(({ role, label, Icon }) => (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => confirmRoleChange(member, role)}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          {label}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => confirmDeactivate(member)}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Remove from the House
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleReactivate(member.id)}
                    disabled={pending}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Welcome back
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirming?.title ?? ""}
        description={confirming?.description ?? ""}
        confirmLabel={confirming?.confirmLabel ?? "Confirm"}
        cancelLabel="Cancel"
        destructive={confirming?.destructive ?? true}
        onConfirm={async () => {
          if (!confirming) return false;
          return confirming.run();
        }}
      />
    </div>
  );
}
