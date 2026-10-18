import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { loadedEnvPath } = await import('../src/config/loadEnv.js');
const { getTitanMailConfig } = await import('../src/config/titanMailConfig.js');

test('loadEnv: Successfully locates canonical backend/.env file', () => {
  assert.ok(loadedEnvPath, 'loadedEnvPath must not be null');
  assert.ok(fs.existsSync(loadedEnvPath), `Loaded path ${loadedEnvPath} must exist on disk`);
  const normalized = path.normalize(loadedEnvPath).toLowerCase();
  assert.ok(
    normalized.endsWith(path.normalize('backend/.env').toLowerCase()) || normalized.endsWith('.env'),
    `Loaded path should point to .env file, got: ${loadedEnvPath}`
  );
});

test('loadEnv: Correctly populates required backend variables into process.env', () => {
  assert.ok(process.env.SUPABASE_URL, 'SUPABASE_URL must be loaded from backend/.env');
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY must be loaded from backend/.env');
  assert.ok(process.env.TITAN_IMAP_HOST, 'TITAN_IMAP_HOST must be loaded from backend/.env');
  assert.ok(process.env.TITAN_IMAP_USER, 'TITAN_IMAP_USER must be loaded from backend/.env');
  assert.ok(process.env.TITAN_IMAP_PASSWORD, 'TITAN_IMAP_PASSWORD must be loaded from backend/.env');
  assert.ok(process.env.TITAN_SMTP_HOST, 'TITAN_SMTP_HOST must be loaded from backend/.env');
  assert.ok(process.env.TITAN_SMTP_USER, 'TITAN_SMTP_USER must be loaded from backend/.env');
  assert.ok(process.env.TITAN_SMTP_PASSWORD, 'TITAN_SMTP_PASSWORD must be loaded from backend/.env');
});

test('loadEnv: TITAN_MAIL_ENABLED and TITAN_MAIL_SYNC_ENABLED default safely to false', () => {
  const config = getTitanMailConfig();
  assert.equal(config.success, true);
  assert.equal(config.data.enabled, false, 'TITAN_MAIL_ENABLED must remain false in production configuration');
  assert.equal(config.data.sync.enabled, false, 'TITAN_MAIL_SYNC_ENABLED must remain false by default');
});

test('getTitanMailConfig: Returns clear missing-variable errors when environment is empty', () => {
  const emptyEnv = {};
  const res = getTitanMailConfig(emptyEnv);
  assert.equal(res.success, false);
  assert.ok(res.errors.length >= 6);
  assert.ok(res.errors.some((e) => e.includes('TITAN_IMAP_HOST is required')));
  assert.ok(res.errors.some((e) => e.includes('TITAN_IMAP_USER is required')));
  assert.ok(res.errors.some((e) => e.includes('TITAN_IMAP_PASSWORD is required')));
  assert.ok(res.errors.some((e) => e.includes('TITAN_SMTP_HOST is required')));
  assert.ok(res.errors.some((e) => e.includes('TITAN_SMTP_USER is required')));
  assert.ok(res.errors.some((e) => e.includes('TITAN_SMTP_PASSWORD is required')));
});
