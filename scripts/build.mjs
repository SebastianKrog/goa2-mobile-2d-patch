/** Combine ordered source fragments into one readable, dependency-free userscript. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const manifest = JSON.parse(await read('src/manifest.json'));
const header = await read('src/userscript-header.txt');
const css = await read('src/styles.css');
const version = JSON.parse(await read('package.json')).version;
const fragments = await Promise.all(manifest.map((name) => read(`src/${name}`)));
let body = fragments.join('');
if (body.split('/* BUILD:STYLES */').length !== 2) throw new Error('Expected one stylesheet marker');
// CSS is source text, not JavaScript: escape template-literal delimiters and backslashes.
const escapedCss = css.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
body = body.replace('/* BUILD:STYLES */', () => 'const css = `\n' + escapedCss + '`;');
body = body.split('\n').map((line) => line ? `  ${line}` : '').join('\n');
const bundle = header + '(() => {\n' + body + '})();\n';
if (!header.includes(`@version      ${version}`) || !body.includes(`version: '${version}'`)) {
  throw new Error('Keep package.json, userscript header, and public API versions in sync');
}
new Script(bundle); // Reject syntax errors before producing an installable file.
const outputs = ['dist/goa2-mobile-2d.user.js', `dist/goa2-mobile-2d-v${version}.txt`];
await mkdir(resolve(root, 'dist'), { recursive: true });
for (const output of outputs) {
  if (process.argv.includes('--check')) {
    if (await read(output) !== bundle) throw new Error(`${output} is stale; run npm run build`);
  } else await writeFile(resolve(root, output), bundle);
}
console.log(process.argv.includes('--check') ? 'Generated files are current.' : `Built v${version}.`);
