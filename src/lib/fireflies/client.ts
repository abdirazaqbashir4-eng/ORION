import "server-only";
import { env, features } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { FirefliesMeetingDetail, FirefliesMeetingSummary } from "./types";

const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

class FirefliesError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "FirefliesError";
  }
}

async function firefliesRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!features.meetings) {
    throw new FirefliesError("Fireflies is not configured. Set FIREFLIES_API_KEY.");
  }

  const res = await fetch(FIREFLIES_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FIREFLIES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await res.json();

  if (!res.ok || body.errors) {
    logger.error("fireflies.request_failed", {
      status: res.status,
      errors: body.errors,
    });
    throw new FirefliesError(
      body.errors?.[0]?.message ?? `Fireflies request failed (${res.status})`,
      body.errors
    );
  }

  return body.data as T;
}

const SUMMARY_FIELDS = `
  overview
  short_summary
  short_overview
  bullet_gist
  gist
  keywords
  action_items
  topics_discussed
  meeting_type
`;

const MEETING_SUMMARY_FIELDS = `
  id
  title
  date
  dateString
  duration
  organizer_email
  participants
  transcript_url
  meeting_link
  summary {
    ${SUMMARY_FIELDS}
  }
`;

export interface ListMeetingsOptions {
  limit?: number;
  skip?: number;
  /** Full-text search over meeting titles. */
  title?: string;
  fromDate?: string;
  toDate?: string;
}

export async function listMeetings(opts: ListMeetingsOptions = {}): Promise<FirefliesMeetingSummary[]> {
  const query = `
    query Transcripts($limit: Int, $skip: Int, $title: String, $fromDate: DateTime, $toDate: DateTime) {
      transcripts(limit: $limit, skip: $skip, title: $title, fromDate: $fromDate, toDate: $toDate) {
        ${MEETING_SUMMARY_FIELDS}
      }
    }
  `;

  const data = await firefliesRequest<{ transcripts: FirefliesMeetingSummary[] }>(query, {
    limit: opts.limit ?? 20,
    skip: opts.skip ?? 0,
    title: opts.title,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
  });

  return data.transcripts;
}

export async function getMeeting(id: string): Promise<FirefliesMeetingDetail> {
  const query = `
    query Transcript($id: String!) {
      transcript(id: $id) {
        ${MEETING_SUMMARY_FIELDS}
        sentences {
          index
          speaker_name
          text
          start_time
          end_time
        }
      }
    }
  `;

  const data = await firefliesRequest<{ transcript: FirefliesMeetingDetail | null }>(query, { id });
  if (!data.transcript) {
    throw new FirefliesError(`Meeting ${id} not found.`);
  }
  return data.transcript;
}

export { FirefliesError };
