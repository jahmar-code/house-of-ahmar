import Link from "next/link";
import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function InitiationCompletePage() {
  const settings = await getHouseSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6 text-center">
        <HouseMonogram
          houseName={settings.houseName}
          size="lg"
          variant="accent"
          className="mx-auto"
        />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            You&apos;re one of us now.
          </h1>
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <p className="text-muted-foreground">
            {settings.houseName} is yours as much as anyone&apos;s. Come in and
            say hello.
          </p>
        </div>

        <Link
          href="/dashboard"
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-8")}
        >
          Go to the Great Hall
        </Link>
      </div>
    </div>
  );
}
