// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://a52a0e6668255ec1ee0d40c688e81386@o4511163069300736.ingest.us.sentry.io/4511163071070208",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Post-call teardown noise from the Vapi/Daily voice stack. These reject
  // after a call has already completed successfully: Daily restarts its
  // audio-level observer while the AudioContext is closing, and Krisp (noise
  // cancellation) rejects when the mic is already released. The page-level
  // `unhandledrejection` guard stops the console spam, but Sentry captures via
  // its own global handler, so it has to be filtered here as well.
  ignoreErrors: [
    'Error when starting local audio level observer',
    "Unable to load a worklet's module",
    'KrispInitError',
    'Error enabling Krisp filter',
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Deliberately OFF. Enabling this collects cookies, HTTP request/response
  // bodies, and generative-AI input/output — which for this app means training
  // call transcripts and their Claude assessments would be sent to Sentry.
  // Identity still reaches Sentry as an opaque profile id (see auth-provider),
  // which is enough to answer "which user hit this" without shipping content.
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
