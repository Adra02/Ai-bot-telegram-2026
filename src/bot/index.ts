import { loadLocalEnv, requireEnv } from '../config/env.js';
import {
  sendTelegramMessage,
  telegramApi,
  type TelegramUpdate
} from './telegramApi.js';
import {
  processTextMessage,
  splitResponse
} from './messageProcessor.js';

loadLocalEnv();

requireEnv('TELEGRAM_BOT_TOKEN');
requireEnv('GEMINI_API_KEY');

let stopped = false;

async function handleUpdate(
  update: TelegramUpdate
): Promise<void> {
  const text = update.message?.text;
  const chatId = update.message?.chat.id;

  if (!text || chatId === undefined) {
    return;
  }

  try {
    const responses = await processTextMessage(text);

    for (const response of responses) {
      for (const chunk of splitResponse(response)) {
        await sendTelegramMessage(chatId, chunk);
      }
    }
  } catch (error) {
    console.error('❌ Errore elaborazione messaggio:', error);

    try {
      await sendTelegramMessage(
        chatId,
        '❌ Si è verificato un errore durante l’elaborazione della richiesta.'
      );
    } catch (telegramError) {
      console.error(
        '❌ Impossibile inviare l’errore su Telegram:',
        telegramError
      );
    }
  }
}

async function startPolling(): Promise<void> {
  try {
    await telegramApi('deleteWebhook', {
      drop_pending_updates: false
    });
  } catch (error) {
    console.error(
      '⚠️ Impossibile rimuovere il webhook:',
      error
    );
  }

  console.log('🤖 DEVFORGE AI avviato correttamente!');
  console.log('📱 In attesa di messaggi Telegram...');

  let offset = 0;

  while (!stopped) {
    try {
      const updates = await telegramApi<TelegramUpdate[]>('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message']
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error('❌ Errore polling Telegram:', error);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

process.once('SIGINT', () => {
  stopped = true;
  console.log('\nRicevuto SIGINT. Arresto DEVFORGE AI...');
});

process.once('SIGTERM', () => {
  stopped = true;
  console.log('\nRicevuto SIGTERM. Arresto DEVFORGE AI...');
});

void startPolling();
