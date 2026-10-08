import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from '../src/config/env.js';
import {
  createProject,
  deleteProject,
  getProject,
  updateProject
} from '../src/projects/projectManager.js';
import {
  applyProjectFileUpdates,
  generateProjectFiles,
  listProjectFiles,
  readProjectFile
} from '../src/projects/codeGenerator.js';
import {
  bumpProjectVersion,
  createVersion,
  deleteVersions,
  getLatestVersion,
  getVersions
} from '../src/projects/versionManager.js';

loadLocalEnv();

const testProjectName = `DEVFORGE SELF TEST ${Date.now()}`;

const project = await createProject(
  testProjectName,
  'Progetto temporaneo per il test automatico.',
  'web',
  'HTML, CSS, JavaScript'
);

try {
  assert.equal(project.version, '0.1.0');
  assert.equal(project.files.length, 0);

  const generated = generateProjectFiles(project);
  assert.equal(generated.length, 3);

  const withFiles =
    (await updateProject(project.id, {
      files: generated,
      projectStructure: generated.map(file => file.path)
    })) ?? null;

  if (!withFiles) {
    throw new Error('Impossibile salvare il progetto con i file generati.');
  }

  assert.equal(withFiles.files.length, 3);
  assert.deepEqual(listProjectFiles(withFiles), [
    'index.html',
    'script.js',
    'style.css'
  ]);
  assert.ok(readProjectFile(withFiles, 'index.html').includes(testProjectName));

  const beforeUpdate = withFiles.files.map(file => ({ ...file }));
  const backup = await createVersion(project.id, beforeUpdate);

  assert.equal(backup.version, 1);
  assert.equal((await getVersions(project.id)).length, 1);
  assert.equal((await getLatestVersion(project.id))?.version, 1);

  const updatedFiles = applyProjectFileUpdates(withFiles, [
    {
      path: 'index.html',
      content: '<!doctype html><html><body><h1>Test update</h1></body></html>'
    }
  ]);

  const updated =
    (await updateProject(project.id, {
      files: updatedFiles,
      version: bumpProjectVersion(withFiles.version),
      status: 'updated'
    })) ?? null;

  if (!updated) {
    throw new Error("Impossibile salvare l'aggiornamento del progetto.");
  }

  assert.equal(updated.version, '0.2.0');
  assert.ok(
    readProjectFile(updated, 'index.html').includes('Test update')
  );
  assert.equal((await getLatestVersion(project.id))?.files.length, 3);

  const workspace = path.resolve(
    'data/workspaces',
    `${project.id}-${testProjectName.toLowerCase().replace(/\\s+/g, '-')}`
  );

  // Il workspace viene creato dal bot, ma non fa parte del test del core.
  if (fs.existsSync(workspace)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }

  console.log('✅ SELF TEST SUPERATO');
  console.log('✅ Creazione progetto');
  console.log('✅ Generazione file');
  console.log('✅ Backup versione');
  console.log('✅ Modifica file');
  console.log('✅ Incremento versione 0.1.0 → 0.2.0');
} finally {
  await deleteVersions(project.id);
  await deleteProject(project.id);
}
