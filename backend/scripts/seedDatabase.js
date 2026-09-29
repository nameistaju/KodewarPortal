import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Team from '../src/models/Team.js';
import Employee from '../src/models/Employee.js';
import { login } from '../src/services/authService.js';
import { DEPARTMENTS, EMPLOYEE_STATUS, ROLES } from '../src/constants/index.js';

const DEFAULT_PASSWORD_PREFIX = 'ChangeThis';

const normalizeEmail = (value) => value?.trim().toLowerCase();

const envValue = (key) => process.env[key]?.trim();

const isEnabled = (key) => envValue(key) !== 'false';

const requireEnv = (key) => {
  const value = envValue(key);
  if (!value) {
    throw new Error(`${key} is required when bootstrap user creation is enabled.`);
  }
  return value;
};

const resolveRole = (value, key) => {
  const normalized = value.trim().toUpperCase();

  if (!Object.values(ROLES).includes(normalized)) {
    throw new Error(`${key} must be one of: ${Object.values(ROLES).join(', ')}`);
  }

  return normalized;
};

const assertPasswordIsSafe = (password) => {
  if (password.startsWith(DEFAULT_PASSWORD_PREFIX)) {
    throw new Error('Bootstrap passwords must be changed before seeding.');
  }
};

const bootstrapUsers = () => [
  {
    label: 'Admin',
    enabled: isEnabled('BOOTSTRAP_ADMIN_ENABLED'),
    nameKey: 'BOOTSTRAP_ADMIN_NAME',
    emailKey: 'BOOTSTRAP_ADMIN_EMAIL',
    passwordKey: 'BOOTSTRAP_ADMIN_PASSWORD',
    roleKey: 'BOOTSTRAP_ADMIN_ROLE',
    department: DEPARTMENTS.ADMIN,
    phone: '+910000000001',
    dob: new Date('1990-01-01')
  },
  {
    label: 'Employee',
    enabled: isEnabled('BOOTSTRAP_EMPLOYEE_ENABLED'),
    nameKey: 'BOOTSTRAP_EMPLOYEE_NAME',
    emailKey: 'BOOTSTRAP_EMPLOYEE_EMAIL',
    passwordKey: 'BOOTSTRAP_EMPLOYEE_PASSWORD',
    roleKey: 'BOOTSTRAP_EMPLOYEE_ROLE',
    department: DEPARTMENTS.DEVELOPMENT,
    phone: '+910000000002',
    dob: new Date('1995-01-01')
  }
];

const readBootstrapUser = (config) => {
  if (!config.enabled) {
    return { ...config, skipped: true };
  }

  const password = requireEnv(config.passwordKey);
  assertPasswordIsSafe(password);

  return {
    ...config,
    name: requireEnv(config.nameKey),
    email: normalizeEmail(requireEnv(config.emailKey)),
    password,
    role: resolveRole(requireEnv(config.roleKey), config.roleKey)
  };
};

const createBootstrapUser = async (config) => {
  if (config.skipped) {
    console.log(`✓ ${config.label} bootstrap disabled`);
    return { ...config, status: 'disabled' };
  }

  const existingUser = await Employee.findOne({ email: config.email }).select('+password +loginAttempts +lockUntil');

  if (existingUser) {
    existingUser.password = config.password;
    existingUser.loginAttempts = 0;
    existingUser.lockUntil = undefined;
    existingUser.forcePasswordChange = false;
    existingUser.mustChangePassword = false;
    await existingUser.save();
    console.log(`✓ ${config.label} already exists (reset passwords/lockouts)`);
    return { ...config, status: 'exists', userId: existingUser._id };
  }

  try {
    const createdUser = await Employee.create({
      name: config.name,
      email: config.email,
      password: config.password,
      role: config.role,
      department: config.department,
      status: EMPLOYEE_STATUS.ACTIVE,
      phone: config.phone,
      dob: config.dob,
      forcePasswordChange: false,
      mustChangePassword: false
    });

    console.log(`✓ ${config.label} created`);
    return { ...config, status: 'created', userId: createdUser._id };
  } catch (error) {
    if (error?.code === 11000) {
      const existingUser = await Employee.findOne({ email: config.email }).select('+password +loginAttempts +lockUntil');
      if (existingUser) {
        existingUser.password = config.password;
        existingUser.loginAttempts = 0;
        existingUser.lockUntil = undefined;
        existingUser.forcePasswordChange = false;
        existingUser.mustChangePassword = false;
        await existingUser.save();
      }
      console.log(`✓ ${config.label} already exists (reset passwords/lockouts)`);
      return { ...config, status: 'exists', userId: existingUser?._id };
    }

    throw error;
  }
};

const verifyBootstrapUser = async (result) => {
  if (result.status === 'disabled') {
    return;
  }

  const users = await Employee.find({ email: result.email }).select('+password role status');

  if (users.length !== 1) {
    throw new Error(`${result.label} verification failed: expected exactly one user, found ${users.length}.`);
  }

  const [user] = users;

  if (user.password === result.password || !user.password.startsWith('$2')) {
    throw new Error(`${result.label} verification failed: password is not hashed.`);
  }

  if (result.status === 'created') {
    await login(
      { email: result.email, password: result.password },
      { ipAddress: 'seed-script', userAgent: 'seed-script' }
    );
  }

  console.log(`✓ ${result.label} verified`);
};

const run = async () => {
  try {
    const usersToSeed = bootstrapUsers().map(readBootstrapUser);

    await connectDB();
    console.log('✓ Connected to MongoDB');

    await Employee.init();

    const results = [];
    for (const userConfig of usersToSeed) {
      results.push(await createBootstrapUser(userConfig));
    }

    for (const result of results) {
      await verifyBootstrapUser(result);
    }

    console.log('✓ Seed completed successfully');
  } catch (error) {
    console.error(error.message || 'Seeding failed');
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
