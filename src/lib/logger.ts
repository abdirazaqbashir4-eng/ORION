import "server-only";

type LogFields = Record<string, unknown>;

function format(level: string, event: string, fields?: LogFields) {
  return JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
}

export const logger = {
  info(event: string, fields?: LogFields) {
    console.log(format("info", event, fields));
  },
  warn(event: string, fields?: LogFields) {
    console.warn(format("warn", event, fields));
  },
  error(event: string, fields?: LogFields) {
    console.error(format("error", event, fields));
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs")
        .then((Sentry) => Sentry.captureMessage(event, { level: "error", extra: fields }))
        .catch(() => {});
    }
  },
};
