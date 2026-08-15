import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="hud-grid-bg flex min-h-screen items-center justify-center p-4">
      <SignIn />
    </div>
  );
}
