#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_CONFIG_PATH = path.join(ROOT_DIR, 'site.config.json');
const CLIENTS_DIR = path.join(ROOT_DIR, 'clients');

main().catch((error) => {
  console.error(`[new-client] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const [clientSlugRaw, clientNameRaw, domainRaw] = process.argv.slice(2);

  if (!clientSlugRaw || !clientNameRaw || !domainRaw) {
    throw new Error('Usage: node tools/new-client.mjs <clientSlug> <clientName> <domain>');
  }

  const clientSlug = clientSlugRaw.trim().toLowerCase();
  const clientName = clientNameRaw.trim();
  const domain = domainRaw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

  if (!/^[a-z0-9-]+$/.test(clientSlug)) {
    throw new Error('clientSlug must contain only lowercase letters, numbers, and hyphens.');
  }

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new Error('domain must look like a valid host (example: client.co.za).');
  }

  const raw = await readFile(BASE_CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);

  config.brand.name = clientName;
  config.brand.legalName = `${clientName} (Pty) Ltd`;

  config.domain.primaryHost = domain;
  config.domain.canonicalHost = domain;
  config.domain.baseUrl = `https://${domain}`;

  config.emails.privacyTo = `hello@${domain}`;
  config.emails.deleteRequestsTo = `delete@${domain}`;
  config.emails.fromNoReply = `no-reply@${domain}`;

  const targetDir = path.join(CLIENTS_DIR, clientSlug);
  const configPath = path.join(targetDir, 'site.config.json');
  const assetsScaffold = path.join(targetDir, 'assets', '.gitkeep');

  await mkdir(path.dirname(assetsScaffold), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(assetsScaffold, '', 'utf8');

  console.log(`[new-client] Created ${path.relative(ROOT_DIR, configPath)}`);
  console.log('[new-client] Next steps:');
  console.log(`1. Update ${path.relative(ROOT_DIR, configPath)} with client-specific details.`);
  console.log(`2. Add brand assets under ${path.relative(ROOT_DIR, path.dirname(assetsScaffold))}.`);
  console.log(`3. Run: npm run brand:apply -- --config clients/${clientSlug}/site.config.json`);
  console.log('4. Deploy generated public_html/ to xneelo public_html/.');
}
