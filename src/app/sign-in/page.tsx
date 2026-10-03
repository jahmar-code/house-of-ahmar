import { Suspense } from "react";
import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const settings = await getHouseSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mb-5 flex justify-center">
            <HouseMonogram houseName={settings.houseName} size="md" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Enter the House
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Good to have you back.
          </p>
        </div>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
