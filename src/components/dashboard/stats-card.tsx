import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  sublabel?: string;
}

export function StatsCard({ icon: Icon, label, value, sublabel }: StatsCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
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
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
