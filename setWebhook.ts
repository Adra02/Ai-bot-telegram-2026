import { loadLocalEnv, requireEnv } from '../src/config/env.js';
import { telegramApi } from '../src/bot/telegramApi.js';

loadLocalEnv();

const webhookUrl = requireEnv('TELEGRAM_WEBHOOK_URL');
const secret = requireEnv('TELEGRAM_WEBHOOK_SECRET');

const result = await telegramApi<{ url: string; pending_update_count: number }>(
  'setWebhook',
  {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false
  }
);

console.log('✅ Webhook Telegram configurato.');
console.log(`🌐 URL: ${result.url}`);
console.log(`📨 Pending updates: ${result.pending_update_count}`);
