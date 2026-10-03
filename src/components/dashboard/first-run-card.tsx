import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { HoaRole } from "@/lib/constants";

interface FirstRunCardProps {
  role: HoaRole;
  houseName: string;
}

/**
 * What the Great Hall shows while the House still has one person in it.
 * A row of zeros reads as broken; this names the one thing that has to happen
 * next and links straight to it.
 */
export function FirstRunCard({ role, houseName }: FirstRunCardProps) {
  const isElder = role === "elder";

  const primary = isElder
    ? { href: "/elder-council/access-codes", label: "Create the first invite code" }
    : { href: "/feed", label: "Write the first post" };

  const secondary = isElder
    ? [
        { href: "/elder-council/settings", label: "Name the House and set the welcome" },
        { href: "/feed", label: "Write the first post" },
      ]
    : [{ href: "/gatherings/new", label: "Plan a gathering" }];

  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Let&apos;s get the family in here
          </h2>
          <p className="text-sm text-muted-foreground">
            {isElder
              ? `You are the first one home. Send everyone a code and ${houseName} starts filling up.`
              : `It is quiet in ${houseName} for now. Say something and the rest will follow.`}
          </p>
        </div>

        <Link
          href={primary.href}
          className={cn(buttonVariants({ size: "lg" }), "h-11 w-full sm:w-auto sm:px-8")}
        >
          {primary.label}
        </Link>

        <div className="flex flex-col gap-1 border-t border-border pt-3 sm:flex-row sm:gap-6">
          {secondary.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {item.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
