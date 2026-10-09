/** Reject implicit cross-module dependencies and writes to imported bindings. */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { analyze } from 'eslint-scope';

const sourceDirectory = new URL('../src/', import.meta.url);
// Application helpers must be declared locally or imported, even when another
// module defines the name. This list contains only language and browser globals.
const browserGlobals = new Set([
  'AbortController', 'Array', 'Boolean', 'Date', 'Error', 'HTMLImageElement',
  'Image', 'JSON', 'Map', 'Math', 'MutationObserver', 'Node', 'Number', 'Object',
  'Promise', 'RegExp', 'ResizeObserver', 'Set', 'String', 'URLSearchParams',
  'WeakMap', 'WeakSet', 'WheelEvent', 'cancelAnimationFrame', 'clearInterval',
  'clearTimeout', 'console', 'decodeURIComponent', 'document', 'encodeURIComponent',
  'fetch', 'getComputedStyle', 'innerHeight', 'localStorage', 'location', 'matchMedia',
  'navigator', 'parseFloat', 'requestAnimationFrame', 'setInterval', 'setTimeout',
  'undefined', 'window',
]);

export function moduleProblems(source, filename = 'module.js') {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  const scopes = analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const problems = [];
  for (const reference of scopes.globalScope.through) {
    const name = reference.identifier.name;
    if (!browserGlobals.has(name)) problems.push(`${filename}: ${name} must be declared or imported`);
  }
  for (const scope of scopes.scopes) {
    for (const variable of scope.variables) {
      if (!variable.defs.some(def => def.type === 'ImportBinding')) continue;
      if (variable.references.some(reference => reference.isWrite()))
        problems.push(`${filename}: cannot write to imported binding ${variable.name}`);
    }
  }
  return [...new Set(problems)];
}

export async function checkModules() {
  const names = (await readdir(sourceDirectory)).filter(name => name.endsWith('.js') && name !== 'bootstrap.js');
  const results = await Promise.all(names.map(async name =>
    moduleProblems(await readFile(new URL(name, sourceDirectory), 'utf8'), `src/${name}`)));
  const problems = results.flat();
  if (problems.length) throw new Error(problems.join('\n'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await checkModules();
  console.log('Module dependencies are explicit.');
}
