import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const credentialsFilePath = fileURLToPath(new URL('../bootstrap-credentials.json', import.meta.url));

const formatUser = (user) => `${user.name}
Email: ${user.email}
Role: ${user.role}
Temporary Password: ${user.temporaryPassword}
Created At: ${user.createdAt}`;

try {
  const file = await fs.readFile(credentialsFilePath, 'utf8');
  const credentials = JSON.parse(file);

  console.log(`Bootstrap credentials loaded from:
${credentialsFilePath}
`);
  console.log(credentials.map(formatUser).join('\n\n'));
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Bootstrap credentials file not found:
${credentialsFilePath}

Start the backend once with NODE_ENV=development and an empty employee collection to create it.`);
    process.exit(1);
  }

  throw error;
}
