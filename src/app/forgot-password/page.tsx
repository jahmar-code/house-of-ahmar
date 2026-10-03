import type { Metadata } from "next";
import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgotten password",
};

export default async function ForgotPasswordPage() {
  const settings = await getHouseSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mb-5 flex justify-center">
            <HouseMonogram houseName={settings.houseName} size="md" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Forgotten password
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            It happens. We&apos;ll email you a link to set a new one.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
