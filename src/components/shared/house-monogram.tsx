import { cn } from "@/lib/utils";

/**
 * Derives the House's letter mark from its (Elder-editable) name, so renaming
 * the House never leaves a stale initial glued to the new name.
 */
export function houseInitial(houseName: string): string {
  return houseName.trim().charAt(0).toUpperCase() || "A";
}

const SIZES = {
  // xs/sm are the in-app chrome (mobile header, sidebar); md/lg are the
  // full-page marks on the gate and the join flow.
  xs: "h-8 w-8 text-base",
  sm: "h-9 w-9 text-lg",
  md: "h-16 w-16 text-2xl",
  lg: "h-24 w-24 text-4xl",
} as const;

interface HouseMonogramProps {
  houseName: string;
  size?: keyof typeof SIZES;
  /**
   * `brand` is the filled mark the House chrome wears (sidebar, mobile header);
   * `accent` is reserved for the one celebratory screen ("You're one of us now.").
   */
  variant?: "default" | "brand" | "accent";
  className?: string;
}

/**
 * The House's identity mark. Purely decorative — every surface that shows it
 * also names the House in text, so it stays out of the accessibility tree.
 */
export function HouseMonogram({
  houseName,
  size = "md",
  variant = "default",
  className,
}: HouseMonogramProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        SIZES[size],
        variant === "accent"
          ? "glow-gold border border-primary/40 bg-card"
          : variant === "brand"
            ? "bg-primary"
            : "border border-border bg-card",
        className
      )}
    >
      <span
        className={cn(
          "tracking-tight",
          variant === "accent"
            ? "font-bold text-primary"
            : variant === "brand"
              ? "font-bold text-primary-foreground"
              : "font-semibold text-foreground"
        )}
      >
        {houseInitial(houseName)}
      </span>
    </div>
  );
}
