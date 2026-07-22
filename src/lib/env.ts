function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  resendApiKey: () => required("RESEND_API_KEY"),
  resendWebhookSecret: () => required("RESEND_WEBHOOK_SECRET"),
  appwriteEndpoint: () => required("APPWRITE_ENDPOINT"),
  appwriteProjectId: () => required("APPWRITE_PROJECT_ID"),
  appwriteApiKey: () => required("APPWRITE_API_KEY"),
  databaseId: () => process.env.APPWRITE_DATABASE_ID ?? "outreach",
  emailDomain: () => required("EMAIL_DOMAIN"),
  fromCold: () => required("FROM_COLD"),
  fromMarketing: () => required("FROM_MARKETING"),
  fromTransactional: () => required("FROM_TRANSACTIONAL"),
  replyTo: () => process.env.REPLY_TO,
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
  cronSecret: () => required("CRON_SECRET"),
  warmupStartVolume: () => Number(process.env.WARMUP_START_VOLUME ?? 10),
  warmupMaxDaily: () => Number(process.env.WARMUP_MAX_DAILY ?? 200),
  warmupGrowthRate: () => Number(process.env.WARMUP_GROWTH_RATE ?? 1.25),
};
