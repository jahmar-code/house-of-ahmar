import { Skeleton } from "@/components/ui/skeleton";

// The directory grid skeleton would otherwise cascade onto a single profile.
export default function MemberProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p role="status" className="sr-only">
        Loading this profile
      </p>
      <Skeleton className="h-72 w-full rounded-xl" aria-hidden="true" />
      <Skeleton className="h-40 w-full rounded-xl" aria-hidden="true" />
    </div>
  );
}
