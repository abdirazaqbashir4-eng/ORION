import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { features } from "@/lib/env";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Resource-based auth check, per Clerk's guidance that path-matching
  // middleware alone can diverge from how Next.js actually routes
  // requests. proxy.ts still protects everything as a first line of
  // defense; this is the second, scoped to exactly what it wraps.
  if (features.auth) {
    await auth.protect();
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          authEnabled={features.auth}
          voiceEnabled={features.ai && features.voiceStt && features.voiceTts}
          visionEnabled={features.ai && features.voiceStt && features.voiceTts}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
