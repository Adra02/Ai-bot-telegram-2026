import type { ProjectFile } from './projectManager.js';
import { getValue, setValue, deleteValue } from '../storage/store.js';

export interface ProjectVersion {
  version: number;
  createdAt: string;
  files: ProjectFile[];
}

function versionsKey(projectId: string): string {
  return `devforge:versions:${projectId}`;
}

export async function getVersions(
  projectId: string
): Promise<ProjectVersion[]> {
  return (await getValue<ProjectVersion[]>(versionsKey(projectId))) ?? [];
}

export async function createVersion(
  projectId: string,
  files: ProjectFile[]
): Promise<ProjectVersion> {
  const existingVersions = await getVersions(projectId);
  const versionNumber = existingVersions.length + 1;

  const version: ProjectVersion = {
    version: versionNumber,
    createdAt: new Date().toISOString(),
    files: files.map(file => ({
      path: file.path,
      content: file.content
    }))
  };

  await setValue(
    versionsKey(projectId),
    [...existingVersions, version]
  );

  return version;
}

export async function getLatestVersion(
  projectId: string
): Promise<ProjectVersion | null> {
  const versions = await getVersions(projectId);

  return versions.length > 0
    ? versions[versions.length - 1]
    : null;
}

export async function getVersion(
  projectId: string,
  versionNumber: number
): Promise<ProjectVersion | null> {
  const versions = await getVersions(projectId);

  return (
    versions.find(
      version => version.version === versionNumber
    ) ?? null
  );
}


export async function deleteVersions(
  projectId: string
): Promise<void> {
  await deleteValue(versionsKey(projectId));
}

export function bumpProjectVersion(
  currentVersion: string
): string {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return '0.2.0';
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  return `${major}.${minor + 1}.0`;
}
