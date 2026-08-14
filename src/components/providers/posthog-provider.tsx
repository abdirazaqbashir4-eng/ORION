"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

export function PostHogProvider({
  apiKey,
  apiHost,
  children,
}: {
  apiKey: string;
  apiHost: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    posthog.init(apiKey, {
      api_host: apiHost,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
    });
  }, [apiKey, apiHost]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
