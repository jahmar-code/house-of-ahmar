import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const settings = await getHouseSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mb-5 flex justify-center">
            <HouseMonogram houseName={settings.houseName} size="md" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Set up your account
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Step 1 of 2 — create your login. You&apos;ll enter your family code
            next.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
