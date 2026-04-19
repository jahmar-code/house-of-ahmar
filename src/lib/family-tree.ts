import type { Member } from "@/types";

export interface RelationshipEdge {
  parentId: string;
  childId: string;
}

export interface TreeNode {
  member: Member;
  x: number;
  y: number;
  depth: number;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: RelationshipEdge[];
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  colWidth: number;
  rowHeight: number;
}

/**
 * Computes a right-to-left horizontal family tree layout.
 *
 * Eldest generation (depth 0 — members with no parents) sits on the RIGHT.
 * Each successive generation is placed one column to the LEFT.
 * Within a generation, members stack vertically.
 *
 * Cycles in the input are tolerated (treated as depth 0 for the offending
 * node); callers should still reject cycles at write time.
 */
export function computeFamilyTreeLayout(
  members: Member[],
  edges: RelationshipEdge[],
  opts: {
    cardWidth?: number;
    cardHeight?: number;
    colGap?: number;
    rowGap?: number;
    paddingX?: number;
    paddingY?: number;
  } = {}
): TreeLayout {
  const cardWidth = opts.cardWidth ?? 200;
  const cardHeight = opts.cardHeight ?? 88;
  const colGap = opts.colGap ?? 80;
  const rowGap = opts.rowGap ?? 24;
  const paddingX = opts.paddingX ?? 40;
  const paddingY = opts.paddingY ?? 40;

  const colWidth = cardWidth + colGap;
  const rowHeight = cardHeight + rowGap;

  // child -> [parents]
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = parentsOf.get(e.childId) ?? [];
    arr.push(e.parentId);
    parentsOf.set(e.childId, arr);
  }

  const depth = new Map<string, number>();
  function computeDepth(id: string, visiting = new Set<string>()): number {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard — treat as root
    visiting.add(id);
    const parents = parentsOf.get(id) ?? [];
    if (parents.length === 0) {
      depth.set(id, 0);
      return 0;
    }
    const d =
      1 + Math.max(...parents.map((p) => computeDepth(p, visiting)));
    depth.set(id, d);
    return d;
  }

  for (const m of members) computeDepth(m.id);

  // Group members by depth, sort each generation alphabetically for stable layout
  const byDepth = new Map<number, Member[]>();
  for (const m of members) {
    const d = depth.get(m.id) ?? 0;
    const arr = byDepth.get(d) ?? [];
    arr.push(m);
    byDepth.set(d, arr);
  }
  for (const arr of byDepth.values()) {
    arr.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const maxDepth = byDepth.size === 0 ? 0 : Math.max(...byDepth.keys());

  const nodes: TreeNode[] = [];
  for (const [d, arr] of byDepth.entries()) {
    arr.forEach((member, i) => {
      // RTL: depth 0 (oldest) sits on the right edge, growing leftward.
      const xCol = maxDepth - d;
      nodes.push({
        member,
        depth: d,
        x: paddingX + xCol * colWidth,
        y: paddingY + i * rowHeight,
      });
    });
  }

  const totalCols = maxDepth + 1;
  const maxRowsInAColumn = Math.max(
    1,
    ...Array.from(byDepth.values()).map((a) => a.length)
  );

  const width = paddingX * 2 + totalCols * colWidth - colGap;
  const height = paddingY * 2 + maxRowsInAColumn * rowHeight - rowGap;

  return {
    nodes,
    edges,
    width: Math.max(width, cardWidth + paddingX * 2),
    height: Math.max(height, cardHeight + paddingY * 2),
    cardWidth,
    cardHeight,
    colWidth,
    rowHeight,
  };
}
