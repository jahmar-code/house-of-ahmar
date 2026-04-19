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
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gold/20 bg-gold/5">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">
            {value}
            {sublabel && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {sublabel}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
