import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              A
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Enter the House
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
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
