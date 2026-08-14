import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";
import { env, features } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.fullName} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  let content: React.ReactNode = children;
  if (features.analytics) {
    content = (
      <PostHogProvider apiKey={env.NEXT_PUBLIC_POSTHOG_KEY!} apiHost={env.NEXT_PUBLIC_POSTHOG_HOST}>
        {content}
      </PostHogProvider>
    );
  }

  const body = (
    <body className="min-h-full flex flex-col hud-grid-bg">
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        disableTransitionOnChange
      >
        <TooltipProvider delay={200}>
          {content}
          <Toaster richColors theme="dark" position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </body>
  );

  const html = (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {body}
    </html>
  );

  if (!features.auth) return html;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "oklch(0.75 0.15 210)",
          colorBackground: "oklch(0.17 0.025 255)",
          colorForeground: "oklch(0.96 0.01 240)",
          colorInput: "oklch(0.22 0.025 258)",
          colorInputForeground: "oklch(0.96 0.01 240)",
        },
      }}
    >
      {html}
    </ClerkProvider>
  );
}
