import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-card">
            <span className="font-heading text-2xl font-bold text-gold">A</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Enter the House
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identify yourself to proceed.
          </p>
        </div>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
