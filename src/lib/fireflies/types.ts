export interface FirefliesSummary {
  overview: string | null;
  short_summary: string | null;
  short_overview: string | null;
  bullet_gist: string | null;
  gist: string | null;
  keywords: string[];
  /** Fireflies returns this as one pre-formatted, newline-separated string, not a list. */
  action_items: string | null;
  topics_discussed: string[];
  meeting_type: string | null;
}

export interface FirefliesSentence {
  index: number;
  speaker_name: string | null;
  text: string;
  start_time: number;
  end_time: number;
}

export interface FirefliesMeetingSummary {
  id: string;
  title: string;
  /** Epoch milliseconds, as returned by the Fireflies API. */
  date: number;
  dateString: string | null;
  duration: number | null;
  organizer_email: string | null;
  participants: string[];
  transcript_url: string | null;
  meeting_link: string | null;
  summary: FirefliesSummary | null;
}

export interface FirefliesMeetingDetail extends FirefliesMeetingSummary {
  sentences: FirefliesSentence[];
}

/** Parses Fireflies' single formatted `action_items` string into discrete items. */
export function parseActionItems(actionItems: string | null | undefined): string[] {
  if (!actionItems) return [];
  return actionItems
    .split("\n")
    .map((line) => line.replace(/^[\s*•\-]+/, "").trim())
    .filter(Boolean);
}
