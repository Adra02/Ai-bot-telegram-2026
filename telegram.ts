import { loadLocalEnv, getEnv, requireEnv } from '../src/config/env.js';
import {
  processTextMessage,
  splitResponse
} from '../src/bot/messageProcessor.js';
import { sendTelegramMessage, type TelegramUpdate } from '../src/bot/telegramApi.js';

loadLocalEnv();

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const expectedSecret = getEnv('TELEGRAM_WEBHOOK_SECRET');
    const receivedSecret = request.headers.get(
      'x-telegram-bot-api-secret-token'
    );

    if (
      !expectedSecret ||
      !receivedSecret ||
      receivedSecret !== expectedSecret
    ) {
      return new Response('Unauthorized', {
        status: 401
      });
    }

    requireEnv('TELEGRAM_BOT_TOKEN');
    requireEnv('GEMINI_API_KEY');

    const update = (await request.json()) as TelegramUpdate;
    const text = update.message?.text;
    const chatId = update.message?.chat.id;

    if (!text || chatId === undefined) {
      return Response.json({ ok: true });
    }

    const responses = await processTextMessage(text);

    for (const response of responses) {
      for (const chunk of splitResponse(response)) {
        await sendTelegramMessage(chatId, chunk);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('❌ Errore webhook Telegram:', error);

    return Response.json(
      {
        ok: false,
        error: 'Webhook processing failed'
      },
      { status: 500 }
    );
  }
}

export function GET(): Response {
  return Response.json({
    ok: true,
    service: 'DEVFORGE AI Telegram Webhook'
  });
}
