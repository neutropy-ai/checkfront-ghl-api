const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://8e4b46aa7a8b6708948a9dc0aea4d7d1@o4510776541511680.ingest.de.sentry.io/4510776543543376",
  sendDefaultPii: true,
  environment: process.env.VERCEL_ENV || "development",
  tracesSampleRate: 0.1,
});

module.exports = Sentry;
