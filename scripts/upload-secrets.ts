#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const secrets = new Map<string, string>();

for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const [key, ...valueParts] = trimmed.split('=');
  const value = valueParts.join('=');

  if (key && value) {
    secrets.set(key, value);
  }
}

const projectName = 'youtube-mcp';

for (const [key, value] of secrets) {
  const secretName = `${projectName}-${key.toLowerCase().replace(/_/g, '-')}`;

  console.log(`Uploading secret: ${secretName}`);

  try {
    execSync(
      `echo -n "${value}" | gcloud secrets create ${secretName} --data-file=- || echo -n "${value}" | gcloud secrets versions add ${secretName} --data-file=-`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error(`Failed to upload ${secretName}`);
  }
}

console.log('\nSecrets uploaded successfully');
