const assert = require('node:assert/strict');
const { test } = require('node:test');
const { build } = require('esbuild');
const path = require('node:path');

test('module checks reject an undeclared application helper even if another source defines it', async () => {
  const { moduleProblems, checkModules } = await import('../scripts/check-modules.mjs');
  assert.deepEqual(moduleProblems('function paint() { document.body.append("ok"); }'), []);
  assert.deepEqual(moduleProblems('function paint() { refresh(); }', 'card.js'), [
    'card.js: refresh must be declared or imported',
  ]);
  assert.deepEqual(moduleProblems('import { refresh } from "./main.js"; refresh();'), []);
  await checkModules();
});

test('module checks allow shared state properties but reject reassignment of an imported binding', async () => {
  const { moduleProblems } = await import('../scripts/check-modules.mjs');
  assert.deepEqual(
    moduleProblems('import { uiState } from "./runtime.js"; uiState.mode = "hand";'),
    [],
  );
  assert.deepEqual(moduleProblems('import { uiState } from "./runtime.js"; uiState = {};'), [
    'module.js: cannot write to imported binding uiState',
  ]);
  assert.deepEqual(
    moduleProblems('const mode = "board"; function local(mode) { return mode; }'),
    [],
  );
});

test('the module bundler rejects references to a helper that its owner does not export', async () => {
  await assert.rejects(
    build({
      stdin: {
        contents: 'import { missingTreeHelper } from "./src/tree-view.js"; missingTreeHelper();',
        resolveDir: path.resolve(__dirname, '..'),
      },
      bundle: true,
      write: false,
      loader: { '.css': 'text' },
      logLevel: 'silent',
    }),
    /No matching export.*missingTreeHelper/,
  );
});
