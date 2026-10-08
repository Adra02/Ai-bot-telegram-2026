# DEVFORGE AI

DEVFORGE AI è una base di AI Software Factory controllata da Telegram.

## Cosa fa già

- crea progetti da una richiesta naturale;
- genera i file iniziali per i progetti web;
- legge i file del progetto prima di una modifica;
- usa Gemini per produrre modifiche complete;
- salva automaticamente una versione prima di ogni modifica;
- incrementa la versione del progetto dopo una modifica riuscita;
- mantiene memoria di progetti, funzionalità e file;
- funziona in locale con polling Telegram;
- è predisposto per Vercel con Telegram Webhook;
- usa storage locale in sviluppo e Redis/Upstash quando configurato per ambienti serverless.

## Requisiti

- Node.js 20 o superiore
- un bot Telegram
- una chiave Gemini
- Git
- account GitHub
- account Vercel

## Avvio su PC

1. Apri PowerShell nella cartella del progetto.
2. Esegui:

```powershell
npm install
```

3. Copia `.env.example` in `.env`.
4. Inserisci nel file `.env` i valori delle variabili richieste.
5. Controlla il progetto:

```powershell
npm run typecheck
```

6. Avvia il bot:

```powershell
npm run dev
```

Il bot userà il polling Telegram in locale.

## GitHub

Puoi creare un repository vuoto su GitHub e caricare questa cartella.

Non caricare mai `.env`.

## Vercel

La cartella contiene già una Vercel Function in `api/telegram.ts`.

1. Importa il repository GitHub in Vercel.
2. Aggiungi le variabili d'ambiente dal file `.env.example`.
3. Per la memoria persistente in produzione collega un database Redis dal Vercel Marketplace.
4. Dopo il deploy imposta `TELEGRAM_WEBHOOK_URL` con l'URL pubblico del progetto.
5. Esegui localmente:

```powershell
npm run set-webhook
```

Il comando registra il webhook Telegram sull'URL Vercel.

## Memoria locale e Vercel

In locale DEVFORGE salva i dati in `data/store`.

Su Vercel il filesystem runtime non deve essere usato come memoria persistente. Quando sono presenti `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (oppure i nomi compatibili `KV_REST_API_URL` e `KV_REST_API_TOKEN`), DEVFORGE usa Redis per progetti e versioni.

## Sicurezza

- `.env` è escluso da Git.
- Il webhook Telegram può essere protetto con `TELEGRAM_WEBHOOK_SECRET`.
- DEVFORGE non esegue automaticamente codice generato sul server principale.
- Il progetto è progettato per aggiungere in futuro un sandbox separato per build e test.
