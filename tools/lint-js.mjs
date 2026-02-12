#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const TARGET_DIRS = ['scripts', 'tools'];
const IGNORE_DIRS = new Set(['node_modules', '.git', 'public_html']);

main().catch((error) => {
  console.error(`[lint:js] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const files = [];

  for (const directory of TARGET_DIRS) {
    const absolute = path.join(ROOT_DIR, directory);
    const discovered = await walk(absolute);
    files.push(...discovered.filter((entry) => /\.(?:js|mjs)$/i.test(entry)));
  }

  const failures = [];
  for (const filePath of files) {
    const result = spawnSync(process.execPath, ['--check', filePath], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    if (result.status !== 0) {
      failures.push({
        filePath,
        stderr: result.stderr.trim(),
      });
    }
  }

  if (failures.length > 0) {
    console.error('[lint:js] Syntax check failed:');
    for (const failure of failures) {
      console.error(`- ${path.relative(ROOT_DIR, failure.filePath)}`);
      if (failure.stderr) {
        console.error(failure.stderr);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[lint:js] Passed (${files.length} files checked).`);
}

async function walk(directoryPath) {
  const dirEntries = await readdir(directoryPath, { withFileTypes: true });
  const paths = [];

  for (const dirEntry of dirEntries) {
    if (IGNORE_DIRS.has(dirEntry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, dirEntry.name);
    if (dirEntry.isDirectory()) {
      paths.push(...await walk(absolutePath));
      continue;
    }

    paths.push(absolutePath);
  }

  return paths;
}
