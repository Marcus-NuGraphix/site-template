#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const dockerfilePath = path.join(ROOT_DIR, 'Dockerfile.local');
const composePath = path.join(ROOT_DIR, 'docker-compose.local.yml');

const dockerfile = `FROM php:8.3-apache\n\nENV APACHE_DOCUMENT_ROOT=/var/www/html/public_html\n\nRUN a2enmod rewrite headers expires \\\n  && sed -ri -e 's!/var/www/html!\\\${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \\\n  && sed -ri -e 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf \\\n  && echo 'ServerName localhost' >> /etc/apache2/apache2.conf\n\nWORKDIR /var/www/html\n`;

const compose = `services:\n  web:\n    build:\n      context: .\n      dockerfile: Dockerfile.local\n    ports:\n      - \"8080:80\"\n    volumes:\n      - ./:/var/www/html\n    restart: unless-stopped\n`;

main().catch((error) => {
  console.error(`[dev:setup] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  await mkdir(path.join(ROOT_DIR, '.docker-local'), { recursive: true });
  await writeFile(dockerfilePath, dockerfile, 'utf8');
  await writeFile(composePath, compose, 'utf8');

  console.log('[dev:setup] Local Docker development files created.');
  console.log('[dev:setup] These files are git-ignored by design:');
  console.log('  - Dockerfile.local');
  console.log('  - docker-compose.local.yml');
  console.log('  - .docker-local/');
  console.log('');
  console.log('Next steps:');
  console.log('1. npm run brand:apply');
  console.log('2. npm run dev:up');
  console.log('3. Open http://localhost:8080');
}
