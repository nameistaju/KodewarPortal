export const isProduction = (process.env.NODE_ENV || 'development') === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  clientOrigins: (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  uploadRoot: process.env.UPLOAD_ROOT || (isProduction ? '/var/www/sharpkode/uploads' : 'uploads'),
  attendanceSelfieRetentionDays: Number(process.env.ATTENDANCE_SELFIE_RETENTION_DAYS || 7),
  businessVisitRetentionDays: Number(process.env.BUSINESS_VISIT_RETENTION_DAYS || 3650),
  organizationTimezone: process.env.ORGANIZATION_TIMEZONE || 'Asia/Kolkata',
  allowNonTransactionalDevelopment: process.env.ALLOW_NON_TRANSACTIONAL_DEVELOPMENT !== 'false',
  defaultOfficeLatitude: Number(process.env.OFFICE_LATITUDE || 0),
  defaultOfficeLongitude: Number(process.env.OFFICE_LONGITUDE || 0),
  defaultOfficeAllowedRadiusMeters: Number(process.env.OFFICE_ALLOWED_RADIUS_METERS || 100)
};

try {
  new Intl.DateTimeFormat('en', { timeZone: env.organizationTimezone }).format(new Date());
} catch {
  throw new Error(`Startup blocked: invalid ORGANIZATION_TIMEZONE: ${env.organizationTimezone}`);
}

const requiredEnvironmentVariables = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  ...(isProduction
    ? [
        'CLIENT_ORIGINS',
        'UPLOAD_ROOT',
        'OFFICE_LATITUDE',
        'OFFICE_LONGITUDE',
        'OFFICE_ALLOWED_RADIUS_METERS'
      ]
    : [])
];

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (key) => !process.env[key] || process.env[key].trim() === ''
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Startup blocked: missing required environment variable(s): ${missingEnvironmentVariables.join(', ')}`
  );
}
if (isProduction) {
  if (env.jwtSecret.length < 32 || env.jwtRefreshSecret.length < 32) {
    throw new Error('Startup blocked: JWT secrets must each contain at least 32 characters');
  }
  if (env.jwtSecret === env.jwtRefreshSecret) {
    throw new Error('Startup blocked: JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const invalidOrigin = env.clientOrigins.find((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== 'https:' || parsed.origin !== origin || origin.includes('*');
    } catch {
      return true;
    }
  });
  if (invalidOrigin) {
    throw new Error(`Startup blocked: CLIENT_ORIGINS contains an invalid production origin: ${invalidOrigin}`);
  }
}

if (
  !Number.isFinite(env.defaultOfficeLatitude) ||
  env.defaultOfficeLatitude < -90 ||
  env.defaultOfficeLatitude > 90 ||
  !Number.isFinite(env.defaultOfficeLongitude) ||
  env.defaultOfficeLongitude < -180 ||
  env.defaultOfficeLongitude > 180 ||
  !Number.isFinite(env.defaultOfficeAllowedRadiusMeters) ||
  env.defaultOfficeAllowedRadiusMeters < 1 ||
  env.defaultOfficeAllowedRadiusMeters > 5000
) {
  throw new Error('Startup blocked: office coordinates or radius are invalid');
}

if (
  !Number.isFinite(env.attendanceSelfieRetentionDays) ||
  env.attendanceSelfieRetentionDays < 1 ||
  env.attendanceSelfieRetentionDays > 365
) {
  throw new Error('Startup blocked: ATTENDANCE_SELFIE_RETENTION_DAYS must be between 1 and 365');
}

if (
  !Number.isFinite(env.businessVisitRetentionDays) ||
  env.businessVisitRetentionDays < 1 ||
  env.businessVisitRetentionDays > 36500
) {
  throw new Error('Startup blocked: BUSINESS_VISIT_RETENTION_DAYS must be between 1 and 36500');
}
