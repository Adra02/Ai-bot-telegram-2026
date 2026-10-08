import { askAI } from '../ai/aiEngine.js';
import {
  createProject,
  getAllProjects,
  updateProject
} from '../projects/projectManager.js';
import {
  applyProjectFileUpdates,
  generateProjectFiles,
  listProjectFiles,
  readProjectFile
} from '../projects/codeGenerator.js';
import {
  bumpProjectVersion,
  createVersion
} from '../projects/versionManager.js';
import {
  createProjectWorkspace,
  syncProjectWorkspace
} from '../projects/projectEngine.js';

const TELEGRAM_LIMIT = 3900;

function splitTelegramMessage(message: string): string[] {
  if (message.length <= TELEGRAM_LIMIT) {
    return [message];
  }

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > TELEGRAM_LIMIT) {
    let cut = remaining.lastIndexOf('\n', TELEGRAM_LIMIT);

    if (cut < 1000) {
      cut = TELEGRAM_LIMIT;
    }

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function projectListMessage(projects: Awaited<ReturnType<typeof getAllProjects>>): string {
  if (projects.length === 0) {
    return '📂 Non hai ancora nessun progetto salvato.';
  }

  return (
    '📂 I TUOI PROGETTI\n\n' +
    projects
      .map(
        (project, index) =>
          `${index + 1}. 🛠 ${project.name}\n` +
          `   📄 ${project.description}\n` +
          `   📱 ${project.platform}\n` +
          `   ⚙️ ${project.technology}\n` +
          `   🔢 Versione: ${project.version}\n` +
          `   💻 File: ${project.files.length}\n` +
          `   🆔 ${project.id}`
      )
      .join('\n\n')
  );
}

export async function processTextMessage(
  text: string
): Promise<string[]> {
  if (text === '/start') {
    return [
      '🤖 Benvenuto in DEVFORGE AI!\n\n' +
        'La tua AI Software Factory è online.\n\n' +
        '🚧 Versione V0.3 — Project + Code + Version Manager'
    ];
  }

  if (text === '/help') {
    return [
      '🛠 DEVFORGE AI\n\n' +
        '/start — Avvia DEVFORGE AI\n' +
        '/help — Mostra questo messaggio\n' +
        '/progetti — Mostra i tuoi progetti\n\n' +
        'Puoi anche scrivere direttamente una richiesta, ad esempio:\n' +
        '"Crea un\'app web chiamata Note Veloci"'
    ];
  }

  if (text === '/progetti') {
    return [projectListMessage(await getAllProjects())];
  }

  if (text.startsWith('/')) {
    return ['❌ Comando non riconosciuto. Usa /help.'];
  }

  const initialResponse = await askAI({ message: text });

  if (!initialResponse.success) {
    return [initialResponse.message];
  }

  /* ========================
   * CREATE
   * ======================== */
  if (
    initialResponse.action === 'CREATE' &&
    initialResponse.project
  ) {
    const projectInfo = initialResponse.project;

    let project = await createProject(
      projectInfo.name,
      projectInfo.description,
      projectInfo.platform,
      projectInfo.technology
    );

    let generatedFiles: string[] = [];

    try {
      if (project.platform === 'web') {
        const files = generateProjectFiles(project);

        project =
          (await updateProject(project.id, {
            files,
            projectStructure: files.map(file => file.path)
          })) ?? project;

        generatedFiles = files.map(file => file.path);
      }

      createProjectWorkspace(project);
      syncProjectWorkspace(project);
    } catch (error) {
      console.error(
        '❌ Errore durante la generazione del progetto:',
        error
      );
    }

    return [
      '🚀 PROGETTO CREATO!\n\n' +
        `🛠 Nome: ${project.name}\n` +
        `📄 Descrizione: ${project.description}\n` +
        `📱 Piattaforma: ${project.platform}\n` +
        `⚙️ Tecnologia: ${project.technology}\n` +
        `🔢 Versione: ${project.version}\n` +
        `🆔 ID: ${project.id}\n\n` +
        (generatedFiles.length > 0
          ? '💻 FILE GENERATI\n' +
            generatedFiles.map(file => `• ${file}`).join('\n') +
            '\n\n'
          : '') +
        '💾 Il progetto è stato salvato nella memoria di DEVFORGE AI.'
    ];
  }

  /* ========================
   * UPDATE
   * ======================== */
  if (
    initialResponse.action === 'UPDATE' &&
    initialResponse.update
  ) {
    const projects = await getAllProjects();

    const wantedName =
      initialResponse.update.projectName.trim().toLowerCase();

    const project = projects.find(
      item => item.name.trim().toLowerCase() === wantedName
    );

    if (!project) {
      return [
        '❌ Non ho trovato un progetto chiamato ' +
          `"${initialResponse.update.projectName}".\n\n` +
          'Usa /progetti per vedere i progetti disponibili.'
      ];
    }

    if (project.files.length === 0) {
      return [
        '❌ Il progetto non contiene ancora file da modificare.'
      ];
    }

    const projectFiles = project.files
      .filter(file => file.path !== 'devforge-project.json')
      .map(file => ({
        path: file.path,
        content: file.content
      }));

    const updateResponse = await askAI({
      message: text,
      projectId: project.id,
      projectName: project.name,
      projectFiles
    });

    if (!updateResponse.success) {
      return [updateResponse.message];
    }

    if (
      updateResponse.action !== 'UPDATE' ||
      !updateResponse.update
    ) {
      return [
        '❌ DEVFORGE AI non ha prodotto una modifica valida.'
      ];
    }

    const files = updateResponse.update.files ?? [];

    if (files.length === 0) {
      return [
        '⚠️ Gemini ha riconosciuto la modifica, ma non ha restituito file da aggiornare.'
      ];
    }

    /*
     * Prima di modificare il progetto,
     * salviamo una copia completa dei file attuali.
     */
    try {
      const backup = await createVersion(
        project.id,
        projectFiles
      );

      console.log(
        `📦 Backup versione ${backup.version} creato per il progetto ${project.name}`
      );
    } catch (error) {
      console.error(
        '❌ Errore durante la creazione del backup:',
        error
      );

      return [
        '❌ Non è stato possibile creare il backup del progetto. La modifica è stata annullata per sicurezza.'
      ];
    }

    const updatedFiles = applyProjectFileUpdates(
      project,
      files
    );

    const requestedFeature =
      initialResponse.update.requestedFeature;

    const newVersion = bumpProjectVersion(
      project.version
    );

    const updatedProject = await updateProject(
      project.id,
      {
        files: updatedFiles,
        projectStructure: listProjectFiles({
          ...project,
          files: updatedFiles
        }),
        requestedFeatures: [
          ...project.requestedFeatures,
          requestedFeature
        ],
        pendingFeatures: [
          ...project.pendingFeatures,
          requestedFeature
        ],
        status: 'updated',
        version: newVersion
      }
    );

    if (!updatedProject) {
      return [
        '⚠️ È stato creato il backup, ma non è stato possibile salvare la nuova versione del progetto.'
      ];
    }

    try {
      syncProjectWorkspace(updatedProject);
    } catch (error) {
      console.error(
        '⚠️ Impossibile sincronizzare il workspace locale:',
        error
      );
    }

    const modifiedFiles = files.map(file => file.path);

    return [
      '🔧 PROGETTO AGGIORNATO!\n\n' +
        `🛠 Progetto: ${updatedProject.name}\n\n` +
        `➕ Nuova funzionalità:\n${requestedFeature}\n\n` +
        '📦 BACKUP CREATO\n' +
        'La versione precedente del progetto è stata salvata.\n\n' +
        '💻 FILE MODIFICATI\n' +
        modifiedFiles.map(file => `• ${file}`).join('\n') +
        '\n\n' +
        `🔢 Versione: ${updatedProject.version}\n\n` +
        '💾 Modifica applicata realmente ai file del progetto.'
    ];
  }

  return [initialResponse.message];
}

export function splitResponse(message: string): string[] {
  return splitTelegramMessage(message);
}
