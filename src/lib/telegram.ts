import { env } from "./env";

/**
 * Sends a plain-text Telegram message via the Bot API to every configured
 * recipient. No-ops silently if TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID aren't
 * set, and never throws — a notification failure should never break the
 * caller (e.g. the inbound email webhook, which must still return 200 to
 * Resend). One recipient's failure doesn't block the others.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = env.telegramBotToken();
  const chatIds = env.telegramChatIds();
  if (!token || chatIds.length === 0) return;

  await Promise.allSettled(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        });
        if (!res.ok) {
          console.error("Telegram notify failed:", chatId, res.status, await res.text().catch(() => ""));
        }
      } catch (e) {
        console.error("Telegram notify error:", chatId, (e as Error).message);
      }
    })
  );
}
