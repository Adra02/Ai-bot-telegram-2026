import type { Project, ProjectFile } from './projectManager.js';

export interface GeneratedFile {
  path: string;
  content: string;
}

const generatedFiles: Record<string, GeneratedFile[]> = {
  web: [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{PROJECT_NAME}}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="app">
    <h1>{{PROJECT_NAME}}</h1>
    <p>{{PROJECT_DESCRIPTION}}</p>

    <section class="placeholder">
      <h2>Progetto creato con DEVFORGE AI</h2>
      <p>Questa è la struttura iniziale del progetto.</p>
    </section>
  </main>

  <script src="script.js"></script>
</body>
</html>
`
    },
    {
      path: 'style.css',
      content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #111827;
  color: #ffffff;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 20px;
}

.placeholder {
  margin-top: 30px;
  padding: 24px;
  border-radius: 16px;
  background: #1f2937;
}
`
    },
    {
      path: 'script.js',
      content: `console.log('DEVFORGE AI project loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('Project initialized successfully');
});
`
    }
  ]
};

function sanitizePath(filePath: string): string {
  const normalized = filePath
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+/, '');

  const parts = normalized.split('/');
  const safeParts: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      safeParts.pop();
      continue;
    }

    safeParts.push(part);
  }

  return safeParts.join('/');
}

function replaceProjectVariables(
  content: string,
  project: Project
): string {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
    .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, project.description);
}

export function generateProjectFiles(
  project: Project
): GeneratedFile[] {
  const templates = generatedFiles[project.platform];

  if (!templates) {
    throw new Error(
      `Generazione file non ancora supportata per la piattaforma: ${project.platform}`
    );
  }

  return templates.map(template => ({
    path: sanitizePath(template.path),
    content: replaceProjectVariables(template.content, project)
  }));
}

export function listProjectFiles(
  project: Project
): string[] {
  return project.files
    .map(file => sanitizePath(file.path))
    .filter(Boolean)
    .sort();
}

export function readProjectFile(
  project: Project,
  filePath: string
): string {
  const safePath = sanitizePath(filePath);

  const file = project.files.find(
    item => sanitizePath(item.path) === safePath
  );

  if (!file) {
    throw new Error(
      `File non trovato nel progetto: ${safePath}`
    );
  }

  return file.content;
}

export function writeProjectFile(
  project: Project,
  filePath: string,
  content: string
): ProjectFile[] {
  const safePath = sanitizePath(filePath);

  if (!safePath) {
    throw new Error('Percorso file non valido.');
  }

  const files = [...project.files];
  const index = files.findIndex(
    file => sanitizePath(file.path) === safePath
  );

  if (index >= 0) {
    files[index] = {
      path: safePath,
      content
    };
  } else {
    files.push({
      path: safePath,
      content
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function applyProjectFileUpdates(
  project: Project,
  updates: GeneratedFile[]
): ProjectFile[] {
  let files = [...project.files];

  for (const update of updates) {
    files = writeProjectFile(
      { ...project, files },
      update.path,
      update.content
    );
  }

  return files;
}
