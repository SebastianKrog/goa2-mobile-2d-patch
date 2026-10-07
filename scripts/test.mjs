/** Run isolated browser fixtures from the repository root; fail on any failed test. */
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(new URL('../tests/', import.meta.url)))
  .filter((name) => /^test-.*\.cjs$/.test(name)).sort();
const failed = [];
for (const file of files) {
  console.log(`\n${file}`);
  const result = spawnSync(process.execPath, [`tests/${file}`], {
    cwd: root, stdio: 'inherit', timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    failed.push(file);
    if (result.error) console.error(result.error.message);
    else if (result.signal) console.error(`${file} terminated by ${result.signal}.`);
    else console.error(`${file} exited with status ${result.status}.`);
  }
}
console.log(`\n${files.length - failed.length}/${files.length} test files passed.`);
if (failed.length) console.error(`Failed files:\n${failed.map(file => `  tests/${file}`).join('\n')}`);
process.exitCode = failed.length ? 1 : 0;
