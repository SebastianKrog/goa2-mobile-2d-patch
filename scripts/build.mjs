/** Bundle explicit source modules into one readable, dependency-free userscript. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { checkModules } from './check-modules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [header, bootstrap, main, packageJson] = await Promise.all([
  read('src/userscript-header.txt'), read('src/bootstrap.js'),
  read('src/main.js'), read('package.json'),
]);
const version = JSON.parse(packageJson).version;
if (!header.includes(`@version      ${version}`) || !main.includes(`version: '${version}'`)) {
  throw new Error('Keep package.json, userscript header, and public API versions in sync');
}
await checkModules();
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  write: false,
  minify: false,
  treeShaking: false,
  charset: 'utf8',
  loader: { '.css': 'text' },
  // Guards run before any module creates DOM, timers, preferences or listeners.
  // The inner bundle keeps all module bindings private to this installation.
  banner: { js: header + '(() => {\n' + bootstrap },
  footer: { js: '})();' },
});
const bundle = result.outputFiles[0].text;
new Script(bundle); // Reject syntax errors before producing an installable file.
const outputs = ['dist/goa2-mobile-2d.user.js', `dist/goa2-mobile-2d-v${version}.txt`];
await mkdir(resolve(root, 'dist'), { recursive: true });
for (const output of outputs) {
  if (process.argv.includes('--check')) {
    if (await read(output) !== bundle) throw new Error(`${output} is stale; run npm run build`);
  } else await writeFile(resolve(root, output), bundle);
}
console.log(process.argv.includes('--check') ? 'Generated files are current.' : `Built v${version}.`);
