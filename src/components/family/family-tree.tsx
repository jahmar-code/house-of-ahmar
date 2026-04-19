"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  computeFamilyTreeLayout,
  type RelationshipEdge,
} from "@/lib/family-tree";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Member } from "@/types";

interface FamilyTreeProps {
  members: Member[];
  edges: RelationshipEdge[];
  /** Optional member id to softly highlight. */
  focusMemberId?: string | null;
}

export function FamilyTree({ members, edges, focusMemberId }: FamilyTreeProps) {
  const layout = useMemo(
    () => computeFamilyTreeLayout(members, edges),
    [members, edges]
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, (typeof layout.nodes)[number]>();
    for (const n of layout.nodes) m.set(n.member.id, n);
    return m;
  }, [layout]);

  return (
    <div
      dir="rtl"
      className="rounded-lg border border-border bg-card overflow-auto"
    >
      <div
        className="relative"
        style={{ width: layout.width, height: layout.height }}
      >
        {/* Connectors (rendered first so cards sit on top) */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={layout.width}
          height={layout.height}
        >
          {layout.edges.map((e, i) => {
            const parent = nodeMap.get(e.parentId);
            const child = nodeMap.get(e.childId);
            if (!parent || !child) return null;

            // Parent sits to the right of child (RTL: bigger x = older).
            // Draw from parent's LEFT edge midpoint to child's RIGHT edge midpoint.
            const px = parent.x;
            const py = parent.y + layout.cardHeight / 2;
            const cx = child.x + layout.cardWidth;
            const cy = child.y + layout.cardHeight / 2;

            // Smooth horizontal Bezier
            const midX = (px + cx) / 2;
            const d = `M ${px} ${py} C ${midX} ${py}, ${midX} ${cy}, ${cx} ${cy}`;

            return (
              <path
                key={`${e.parentId}-${e.childId}-${i}`}
                d={d}
                fill="none"
                stroke="oklch(0.78 0.12 85 / 0.45)"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {/* Member cards */}
        {layout.nodes.map((n) => {
          const isFocus = focusMemberId === n.member.id;
          return (
            <Link
              key={n.member.id}
              href={`/members/${n.member.id}`}
              dir="ltr"
              className={`absolute flex items-center gap-3 rounded-md border bg-secondary/40 px-3 py-2 transition-all hover:bg-secondary/70 hover:border-gold/40 ${
                isFocus
                  ? "border-gold/50 ring-2 ring-gold/30"
                  : "border-border"
              } ${!n.member.isActive ? "opacity-50" : ""}`}
              style={{
                left: n.x,
                top: n.y,
                width: layout.cardWidth,
                height: layout.cardHeight,
              }}
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={n.member.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-gold/10 text-sm text-gold">
                  {n.member.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {n.member.displayName}
                  </span>
                  {n.member.role === "elder" && (
                    <Badge
                      variant="outline"
                      className="border-gold/30 text-[9px] text-gold leading-none px-1 py-0.5"
                    >
                      elder
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Generation {n.depth + 1}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
