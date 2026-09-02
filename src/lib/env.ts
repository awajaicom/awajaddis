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
  /** Optional — inbox notifications no-op silently when either is unset. */
  telegramBotToken: () => process.env.TELEGRAM_BOT_TOKEN,
  /** Comma-separated chat IDs — every recipient gets the same notification. */
  telegramChatIds: (): string[] =>
    (process.env.TELEGRAM_CHAT_ID ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  /**
   * AFROMESSAGE_TOKEN itself is intentionally NOT here — lib/sms/client.ts
   * reads it directly from process.env so a missing token degrades
   * gracefully (SMS_ENABLED=false keeps working) instead of throwing.
   */
  afromessageSender: () => process.env.AFROMESSAGE_SENDER ?? "",
  afromessageIdentifierId: () => process.env.AFROMESSAGE_IDENTIFIER_ID || undefined,
  afromessageBaseUrl: () => process.env.AFROMESSAGE_BASE_URL || "https://api.afromessage.com",
  afromessageCallbackSecret: () => process.env.AFROMESSAGE_CALLBACK_SECRET || undefined,
  smsEnabled: () => process.env.SMS_ENABLED === "true",
  smsDryRun: () => process.env.SMS_DRY_RUN === "true",
};
