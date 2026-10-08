import { requireEnv } from '../config/env.js';

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export async function telegramApi<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');

  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body ?? {})
    }
  );

  const data =
    (await response.json()) as TelegramResponse<T>;

  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(
      `Telegram API ${method} fallita: ${
        data.description ?? `HTTP ${response.status}`
      }`
    );
  }

  return data.result;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string
): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text
  });
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
  };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}
