// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { parseSentryTracesSampleRate } from "./lib/sentry-sampling";

Sentry.init({
  dsn: "https://3372f2ef28f0008a74b965e76a9dd7b4@o4512027852668928.ingest.de.sentry.io/4512027952545872",

  // Errors are unaffected; this only controls performance trace sampling.
  tracesSampleRate: parseSentryTracesSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
  ),

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
