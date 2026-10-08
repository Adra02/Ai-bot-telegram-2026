import fs from 'node:fs';
import path from 'node:path';
import type { Project } from './projectManager.js';
import { isRemoteStorageConfigured } from '../config/env.js';

const workspacesDirectory = path.resolve('data/workspaces');

function sanitizeProjectName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function getWorkspacePath(project: Project): string {
  return path.join(
    workspacesDirectory,
    `${project.id}-${sanitizeProjectName(project.name)}`
  );
}

export function createProjectWorkspace(
  project: Project
): string {
  const workspacePath = getWorkspacePath(project);

  if (isRemoteStorageConfigured()) {
    return workspacePath;
  }

  if (!fs.existsSync(workspacesDirectory)) {
    fs.mkdirSync(workspacesDirectory, { recursive: true });
  }

  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }

  syncProjectWorkspace(project);
  return workspacePath;
}

export function getProjectWorkspace(
  project: Project
): string {
  return getWorkspacePath(project);
}

export function workspaceExists(
  project: Project
): boolean {
  if (isRemoteStorageConfigured()) {
    return true;
  }

  return fs.existsSync(getWorkspacePath(project));
}

export function syncProjectWorkspace(
  project: Project
): void {
  if (isRemoteStorageConfigured()) {
    return;
  }

  const workspacePath = getWorkspacePath(project);

  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }

  for (const file of project.files) {
    const safeRelativePath = file.path
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(part => part && part !== '..' && part !== '.')
      .join('/');

    if (!safeRelativePath) {
      continue;
    }

    const fullPath = path.join(
      workspacePath,
      safeRelativePath
    );

    const directory = path.dirname(fullPath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFileSync(
      fullPath,
      file.content,
      'utf8'
    );
  }

  const projectInfoPath = path.join(
    workspacePath,
    'devforge-project.json'
  );

  fs.writeFileSync(
    projectInfoPath,
    JSON.stringify(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        platform: project.platform,
        technology: project.technology,
        version: project.version,
        createdAt: project.createdAt,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    'utf8'
  );
}
