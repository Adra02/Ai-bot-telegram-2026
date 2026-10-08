import { GoogleGenAI } from '@google/genai';
import { getEnv, loadLocalEnv, requireEnv } from '../config/env.js';

loadLocalEnv();

export interface AIRequest {
  message: string;
  projectId?: string;
  projectName?: string;
  projectFiles?: {
    path: string;
    content: string;
  }[];
}

export interface AIFileUpdate {
  path: string;
  content: string;
}

export interface AIResponse {
  success: boolean;
  message: string;
  action?: 'CREATE' | 'UPDATE' | 'CHAT';
  project?: {
    name: string;
    description: string;
    platform: string;
    technology: string;
  };
  update?: {
    projectName: string;
    requestedFeature: string;
    files?: AIFileUpdate[];
  };
}

const apiKey = requireEnv('GEMINI_API_KEY');
const model = getEnv('GEMINI_MODEL') || 'gemini-3.6-flash';

const ai = new GoogleGenAI({ apiKey });

const SYSTEM_PROMPT = `
Sei DEVFORGE AI, una AI Software Factory professionale.

Il tuo compito è creare e modificare software reali.

Devi classificare ogni richiesta in:

CREATE
UPDATE
CHAT

========================
CREATE
========================

Quando l'utente vuole creare un progetto, rispondi ESATTAMENTE:

ACTION: CREATE
Nome: ...
Descrizione: ...
Piattaforma: ...
Tecnologia: ...

La piattaforma deve essere una parola semplice quando possibile, ad esempio:
web
android
ios
desktop
game
api

========================
UPDATE
========================

Quando l'utente vuole modificare un progetto esistente, devi analizzare i file forniti.

Rispondi ESATTAMENTE nel seguente formato:

ACTION: UPDATE
Progetto: ...
Funzionalità: ...
FILE: nome-del-file
CONTENT:
[contenuto completo del file modificato]
END_FILE

Puoi includere più file.

REGOLE IMPORTANTI PER GLI UPDATE:

1. Modifica SOLO i file realmente necessari.
2. Restituisci il contenuto COMPLETO dei file modificati.
3. Non usare "...", "[resto del codice]" o placeholder.
4. Non eliminare funzionalità già esistenti.
5. Mantieni le funzionalità esistenti salvo esplicita richiesta dell'utente.
6. Il codice deve essere completo e utilizzabile.
7. Se una modifica richiede HTML, CSS e JavaScript, modifica tutti i file necessari.
8. Usa esclusivamente i file esistenti forniti nel contesto come base, salvo quando la richiesta richiede realmente un nuovo file.
9. Non restituire file non modificati.
10. Prima di rispondere ragiona sui file nel loro insieme e mantieni la compatibilità tra loro.

========================
CHAT
========================

Se l'utente sta semplicemente conversando:

ACTION: CHAT

Poi rispondi normalmente.

Rispondi sempre in italiano.

Non inventare nomi di progetti o funzionalità non richieste.
`;

async function generateWithRetry(
  prompt: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🧠 Gemini: tentativo ${attempt}/${maxAttempts}`);

      const response = await ai.models.generateContent({
        model,
        contents: prompt
      });

      const text = response.text?.trim();

      if (!text) {
        throw new Error('Gemini non ha restituito una risposta.');
      }

      return text;
    } catch (error) {
      lastError = error;

      const errorText =
        error instanceof Error
          ? error.message
          : String(error);

      const isTemporaryError =
        errorText.includes('503') ||
        errorText.includes('UNAVAILABLE') ||
        errorText.includes('high demand') ||
        errorText.includes('429') ||
        errorText.includes('RESOURCE_EXHAUSTED');

      console.error(
        `❌ Gemini tentativo ${attempt} fallito:`,
        errorText
      );

      if (!isTemporaryError || attempt >= maxAttempts) {
        throw error;
      }

      const waitTime = attempt * 5000;

      console.log(
        `⏳ Nuovo tentativo tra ${waitTime / 1000} secondi...`
      );

      await new Promise(resolve =>
        setTimeout(resolve, waitTime)
      );
    }
  }

  throw lastError;
}

function parseUpdateFiles(text: string): AIFileUpdate[] {
  const files: AIFileUpdate[] = [];

  const fileRegex =
    /FILE:\s*(.+?)\s*[\r\n]+CONTENT:\s*[\r\n]?([\s\S]*?)\s*END_FILE/g;

  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(text)) !== null) {
    const filePath = match[1].trim();
    const content = match[2];

    if (!filePath || !content.trim()) {
      continue;
    }

    files.push({
      path: filePath,
      content
    });
  }

  return files;
}

export async function askAI(
  request: AIRequest
): Promise<AIResponse> {
  try {
    console.log('🧠 DEVFORGE AI: richiesta ricevuta');
    console.log('📩 Messaggio:', request.message);

    const projectContext =
      request.projectName &&
      request.projectFiles &&
      request.projectFiles.length > 0
        ? `

PROGETTO ESISTENTE:
Nome: ${request.projectName}
ID: ${request.projectId ?? 'non specificato'}

FILE DEL PROGETTO:

${request.projectFiles
  .map(
    file =>
      `--- FILE: ${file.path} ---\n${file.content}\n--- FINE FILE ---`
  )
  .join('\n\n')}
`
        : '';

    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      projectContext +
      `\nRichiesta dell'utente:\n${request.message}`;

    const text = await generateWithRetry(prompt);

    console.log('🤖 Risposta Gemini:', text);

    const createMatch = text.match(
      /^ACTION:\s*CREATE\s*[\r\n]+Nome:\s*(.+?)\s*[\r\n]+Descrizione:\s*(.+?)\s*[\r\n]+Piattaforma:\s*(.+?)\s*[\r\n]+Tecnologia:\s*(.+?)\s*$/s
    );

    if (createMatch) {
      return {
        success: true,
        action: 'CREATE',
        message: text,
        project: {
          name: createMatch[1].trim(),
          description: createMatch[2].trim(),
          platform: createMatch[3].trim().toLowerCase(),
          technology: createMatch[4].trim()
        }
      };
    }

    const updateMatch = text.match(
      /^ACTION:\s*UPDATE\s*[\r\n]+Progetto:\s*(.+?)\s*[\r\n]+Funzionalità:\s*(.+?)(?=\s*FILE:|$)/s
    );

    if (updateMatch) {
      return {
        success: true,
        action: 'UPDATE',
        message: text,
        update: {
          projectName: updateMatch[1].trim(),
          requestedFeature: updateMatch[2].trim(),
          files: parseUpdateFiles(text)
        }
      };
    }

    if (/^ACTION:\s*CHAT\b/i.test(text)) {
      const chatMessage = text
        .replace(/^ACTION:\s*CHAT\s*/i, '')
        .trim();

      return {
        success: true,
        action: 'CHAT',
        message: chatMessage || 'Come posso aiutarti?'
      };
    }

    return {
      success: true,
      action: 'CHAT',
      message: text
    };
  } catch (error) {
    console.error('❌ Errore Gemini:', error);

    return {
      success: false,
      message:
        '❌ Gemini non è temporaneamente disponibile. Riprova tra qualche secondo.'
    };
  }
}
