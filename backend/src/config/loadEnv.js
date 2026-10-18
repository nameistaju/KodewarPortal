import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canonical backend directory (this file is at backend/src/config/loadEnv.js)
const backendDir = path.resolve(__dirname, '../..');
const repoRootDir = path.resolve(backendDir, '..');

/**
 * Candidate locations for the .env file in order of precedence:
 * 1. Explicit DOTENV_CONFIG_PATH
 * 2. Explicit ENV_FILE
 * 3. Canonical backend/.env
 * 4. process.cwd()/.env (e.g. running from inside backend directory)
 * 5. process.cwd()/backend/.env (e.g. running from repository root)
 * 6. repoRootDir/.env
 */
const candidates = [
  process.env.DOTENV_CONFIG_PATH,
  process.env.ENV_FILE,
  path.resolve(backendDir, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(repoRootDir, '.env')
].filter(Boolean);

let loadedEnvPath = null;

for (const candidatePath of candidates) {
  try {
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      dotenv.config({ path: candidatePath });
      loadedEnvPath = candidatePath;
      break;
    }
  } catch {
    // Continue searching other candidates
  }
}

if (!loadedEnvPath) {
  dotenv.config();
}

export { loadedEnvPath };
export default loadedEnvPath;
