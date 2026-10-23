import type { Metadata } from "next";
import { SignUpForm } from "@/app/sign-up/sign-up-form";
import { WorkshopAuthFrame } from "@/components/workshop/auth-frame";

export const metadata: Metadata = { title: "Create account" };

export default function WorkshopSignUpPage() {
  return (
    <WorkshopAuthFrame
      title="Create your account"
      description="Use the email an admin added to the operator list. An account alone grants no access."
    >
      <SignUpForm
        nextPath="/workshop"
        signInHref="/workshop/sign-in"
        signInLabel="Sign in"
        signInPrompt="Already have an account?"
        confirmOnCurrentOrigin
      />
    </WorkshopAuthFrame>
  );
}
