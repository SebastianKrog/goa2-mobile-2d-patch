/** Run isolated browser fixtures from the repository root; fail on any failed test. */
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(new URL('../tests/', import.meta.url)))
  .filter((name) => /^test-.*\.cjs$/.test(name)).sort();
let failed = 0;
for (const file of files) {
  console.log(`\n${file}`);
  const result = spawnSync(process.execPath, [`tests/${file}`], {
    cwd: root, stdio: 'inherit', timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    failed++;
    if (result.error) console.error(result.error.message);
  }
}
console.log(`\n${files.length - failed}/${files.length} test files passed.`);
process.exitCode = failed ? 1 : 0;
