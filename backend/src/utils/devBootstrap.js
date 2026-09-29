import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { fileURLToPath } from 'url';
import Employee from '../models/Employee.js';
import { DEPARTMENTS, ROLES } from '../constants/index.js';
import { env, isProduction } from '../config/env.js';
import { generateTemporaryPassword } from './password.js';
import logger from './logger.js';

const credentialsFilePath = fileURLToPath(new URL('../../bootstrap-credentials.json', import.meta.url));

const developmentUsers = [
  {
    name: 'SharpKode Admin',
    email: 'admin@sharpkode.com',
    phone: '+910000000001',
    department: DEPARTMENTS.ADMIN,
    dob: new Date('1990-01-01'),
    role: ROLES.ADMIN
  },
  {
    name: 'Rahul Test',
    email: 'rahulmarketing@sharpkode.com',
    phone: '+910000000002',
    department: DEPARTMENTS.MARKETING,
    dob: new Date('1995-01-01'),
    role: ROLES.EMPLOYEE
  },
  {
    name: 'Rahul IT',
    email: 'rahulit@sharpkode.com',
    phone: '+910000000003',
    department: DEPARTMENTS.DEVELOPMENT,
    dob: new Date('1996-01-01'),
    role: ROLES.EMPLOYEE
  }
];

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const printBootstrapCredentials = (credentials) => {
  const admin = credentials.find((item) => item.email === 'admin@sharpkode.com');
  const marketing = credentials.find((item) => item.email === 'rahulmarketing@sharpkode.com');
  const it = credentials.find((item) => item.email === 'rahulit@sharpkode.com');
  const lineFor = (credential, fallbackEmail) =>
    credential
      ? `Email: ${credential.email}\nTemporary Password: ${credential.temporaryPassword}`
      : `Email: ${fallbackEmail}\nTemporary Password: already exists; not available`;

  console.log(`
Bootstrap Users Created

Admin:
${lineFor(admin, 'admin@sharpkode.com')}

Marketing Employee:
${lineFor(marketing, 'rahulmarketing@sharpkode.com')}

IT Employee:
${lineFor(it, 'rahulit@sharpkode.com')}

Credentials saved to:
${credentialsFilePath}
`);
};

export const runDevelopmentBootstrap = async () => {
  if (isProduction || env.nodeEnv !== 'development') {
    return;
  }

  const existingAdmin = await Employee.findOne({ email: 'admin@sharpkode.com' }).select('_id email');

  if (existingAdmin) {
    logger.info('Development bootstrap skipped because admin already exists', {
      adminEmail: existingAdmin.email
    });
    return;
  }

  if (await fileExists(credentialsFilePath)) {
    logger.warn('Development bootstrap skipped because credential file already exists', {
      credentialsFilePath
    });
    return;
  }

  const credentials = [];
  const joinDate = new Date();
  const existingBootstrapEmails = new Set(
    await Employee.find({
      email: { $in: developmentUsers.map((user) => user.email) }
    }).distinct('email')
  );

  for (const user of developmentUsers) {
    if (existingBootstrapEmails.has(user.email)) {
      continue;
    }

    const temporaryPassword = generateTemporaryPassword();

    await Employee.create({
      ...user,
      joinDate,
      password: temporaryPassword,
      forcePasswordChange: true,
      mustChangePassword: true
    });

    credentials.push({
      name: user.name,
      email: user.email,
      role: user.role,
      temporaryPassword,
      createdAt: new Date().toISOString()
    });
  }

  if (credentials.length === 0) {
    logger.info('Development bootstrap skipped because bootstrap users already exist');
    return;
  }

  await fs.writeFile(credentialsFilePath, `${JSON.stringify(credentials, null, 2)}\n`, {
    flag: 'wx'
  });

  printBootstrapCredentials(credentials);

  logger.warn('Development bootstrap created initial users. Disable before shared environments.', {
    credentialsFilePath,
    credentials
  });
};
