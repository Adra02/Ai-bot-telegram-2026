import fs from 'node:fs';
import path from 'node:path';
import type { GeneratedFile } from './codeGenerator.js';
import { getValue, setValue, deleteValue } from '../storage/store.js';

export interface ProjectFile {
  path: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  platform: string;
  technology: string;

  status: string;
  version: string;

  requestedFeatures: string[];
  completedFeatures: string[];
  pendingFeatures: string[];

  bugs: string[];
  decisions: string[];

  projectStructure: string[];

  files: ProjectFile[];

  createdAt: string;
  updatedAt: string;
}

const legacyProjectsDirectory = path.resolve('data/projects');
const PROJECT_INDEX_KEY = 'devforge:projects:index';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ');
}

function addUniqueFeature(
  features: string[],
  feature: string
): string[] {
  const normalizedFeature = normalizeText(feature);

  const alreadyExists = features.some(
    existingFeature => normalizeText(existingFeature) === normalizedFeature
  );

  if (alreadyExists) {
    return features;
  }

  return [...features, feature.trim()];
}

function deduplicateFiles(files: ProjectFile[]): ProjectFile[] {
  const map = new Map<string, ProjectFile>();

  for (const file of files) {
    const safePath = file.path.replace(/\\/g, '/').trim();

    if (!safePath) {
      continue;
    }

    map.set(safePath, {
      path: safePath,
      content: file.content
    });
  }

  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function migrateProject(data: Partial<Project>): Project {
  const now = new Date().toISOString();

  const files = Array.isArray(data.files)
    ? data.files
    : [];

  return {
    id: data.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: data.name ?? 'Progetto senza nome',
    description: data.description ?? '',
    platform: data.platform ?? 'unknown',
    technology: data.technology ?? 'unknown',

    status: data.status ?? 'created',
    version: data.version ?? '0.1.0',

    requestedFeatures: data.requestedFeatures ?? [],
    completedFeatures: data.completedFeatures ?? [],
    pendingFeatures: data.pendingFeatures ?? [],

    bugs: data.bugs ?? [],
    decisions: data.decisions ?? [],

    projectStructure: data.projectStructure ?? [],

    files: deduplicateFiles(files),

    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now
  };
}

async function readLegacyProjects(): Promise<Project[]> {
  if (!fs.existsSync(legacyProjectsDirectory)) {
    return [];
  }

  const files = fs
    .readdirSync(legacyProjectsDirectory)
    .filter((file: string) => file.endsWith('.json'));

  const projects: Project[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(
        path.join(legacyProjectsDirectory, file),
        'utf8'
      );

      projects.push(migrateProject(JSON.parse(raw) as Partial<Project>));
    } catch {
      // Ignora file legacy corrotti per non bloccare l'avvio.
    }
  }

  return projects;
}

async function getProjectIndex(): Promise<string[]> {
  const ids = await getValue<string[]>(PROJECT_INDEX_KEY);
  return ids ?? [];
}

async function setProjectIndex(ids: string[]): Promise<void> {
  await setValue(PROJECT_INDEX_KEY, [...new Set(ids)]);
}

export async function createProject(
  name: string,
  description: string,
  platform: string,
  technology: string,
  files: ProjectFile[] = []
): Promise<Project> {
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const project: Project = {
    id,
    name: name.trim(),
    description: description.trim(),
    platform: platform.trim(),
    technology: technology.trim(),

    status: 'created',
    version: '0.1.0',

    requestedFeatures: [],
    completedFeatures: [],
    pendingFeatures: [],

    bugs: [],
    decisions: [],

    projectStructure: [],

    files: deduplicateFiles(files),

    createdAt: now,
    updatedAt: now
  };

  await setValue(`devforge:project:${project.id}`, project);

  const ids = await getProjectIndex();
  await setProjectIndex([...ids, project.id]);

  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  const project = await getValue<Project>(`devforge:project:${id}`);

  if (!project) {
    return null;
  }

  const migrated = migrateProject(project);

  await setValue(`devforge:project:${id}`, migrated);

  return migrated;
}

export async function getAllProjects(): Promise<Project[]> {
  const ids = await getProjectIndex();

  if (ids.length === 0) {
    const legacyProjects = await readLegacyProjects();

    if (legacyProjects.length > 0) {
      for (const project of legacyProjects) {
        await setValue(`devforge:project:${project.id}`, project);
      }

      await setProjectIndex(legacyProjects.map(project => project.id));
      return legacyProjects;
    }

    return [];
  }

  const projects: Project[] = [];

  for (const id of ids) {
    const project = await getProject(id);

    if (project) {
      projects.push(project);
    }
  }

  return projects.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project | null> {
  const project = await getProject(id);

  if (!project) {
    return null;
  }

  let finalUpdates = { ...updates };

  if (updates.requestedFeatures) {
    const uniqueFeatures = updates.requestedFeatures.reduce(
      (result, feature) => addUniqueFeature(result, feature),
      [] as string[]
    );

    finalUpdates = {
      ...finalUpdates,
      requestedFeatures: uniqueFeatures
    };
  }

  if (updates.pendingFeatures) {
    const uniquePendingFeatures = updates.pendingFeatures.reduce(
      (result, feature) => addUniqueFeature(result, feature),
      [] as string[]
    );

    finalUpdates = {
      ...finalUpdates,
      pendingFeatures: uniquePendingFeatures
    };
  }

  if (updates.completedFeatures) {
    const uniqueCompletedFeatures = updates.completedFeatures.reduce(
      (result, feature) => addUniqueFeature(result, feature),
      [] as string[]
    );

    finalUpdates = {
      ...finalUpdates,
      completedFeatures: uniqueCompletedFeatures
    };
  }

  if (updates.files) {
    finalUpdates = {
      ...finalUpdates,
      files: deduplicateFiles(updates.files)
    };
  }

  const updatedProject: Project = {
    ...project,
    ...finalUpdates,
    updatedAt: new Date().toISOString()
  };

  await setValue(
    `devforge:project:${id}`,
    updatedProject
  );

  return updatedProject;
}

export async function deleteProject(id: string): Promise<boolean> {
  const project = await getProject(id);

  if (!project) {
    return false;
  }

  await deleteValue(`devforge:project:${id}`);

  const ids = await getProjectIndex();
  await setProjectIndex(ids.filter(projectId => projectId !== id));

  return true;
}

export function mergeProjectFiles(
  currentFiles: ProjectFile[],
  updates: GeneratedFile[]
): ProjectFile[] {
  return deduplicateFiles([
    ...currentFiles,
    ...updates
  ]);
}
