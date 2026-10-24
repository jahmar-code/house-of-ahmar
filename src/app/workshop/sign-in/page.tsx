import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { WorkshopAuthFrame } from "@/components/workshop/auth-frame";

export const metadata: Metadata = { title: "Sign in" };

export default function WorkshopSignInPage() {
  return (
    <WorkshopAuthFrame title="Enter the Workshop" description="Monitor and share your running agents.">
      <Suspense>
        <SignInForm
          fallbackPath="/workshop"
          submitLabel="Enter the Workshop"
          signUpHref="/workshop/sign-up"
          confirmNext="/workshop"
          confirmOnCurrentOrigin
        />
      </Suspense>
    </WorkshopAuthFrame>
  );
}
