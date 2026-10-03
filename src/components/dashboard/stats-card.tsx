import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  sublabel?: string;
  /** Makes the whole tile a link to the section the number belongs to. */
  href?: string;
}

export function StatsCard({
  icon: Icon,
  label,
  value,
  sublabel,
  href,
}: StatsCardProps) {
  const card = (
    // Restraint: the chip stays neutral. The orange accent belongs to the one
    // primary action, the active nav item and the Elder badge — a wall of
    // accented chips turns it into wallpaper.
    <Card className="h-full border-border bg-card transition-colors hover:border-foreground/20">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {value}
            {sublabel && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {sublabel}
              </span>
            )}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  );
}
