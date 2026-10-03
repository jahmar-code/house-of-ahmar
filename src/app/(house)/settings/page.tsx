import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileSettingsForm } from "./profile-settings-form";

export const metadata = {
  title: "Your profile",
};

export default async function SettingsPage() {
  // The (house) layout already guards this route; this second read is here for
  // the member row itself, and redirects rather than throwing if the session
  // lapsed between the two.
  const ctx = await requirePageAuth();
  if (!ctx) redirect("/initiation");

  const member = await db.query.members.findFirst({
    where: eq(members.id, ctx.memberId),
  });
  if (!member) redirect("/initiation");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Your profile"
        description="This is how the rest of the House sees you. Change any of it, any time."
      />

      <ProfileSettingsForm
        memberId={member.id}
        displayName={member.displayName}
        fullName={member.fullName}
        bio={member.bio}
        birthday={member.birthday}
        phone={member.phone}
        avatarUrl={member.avatarUrl}
      />
    </div>
  );
}
