import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
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
            Request Entry
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Create your identity. You will need a House code.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
