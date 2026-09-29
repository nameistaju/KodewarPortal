export const isProduction = (process.env.NODE_ENV || 'development') === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  clientOrigins: (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_minimum_32_characters_long_for_dev_kodewar',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_minimum_32_characters_dev',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  uploadRoot: process.env.UPLOAD_ROOT || (isProduction ? '/var/www/sharpkode/uploads' : 'uploads'),
  organizationTimezone: process.env.ORGANIZATION_TIMEZONE || 'Asia/Kolkata',
  defaultOfficeLatitude: Number(process.env.OFFICE_LATITUDE || 17.72861938927439),
  defaultOfficeLongitude: Number(process.env.OFFICE_LONGITUDE || 83.3146940456679),
  defaultOfficeAllowedRadiusMeters: Number(process.env.OFFICE_ALLOWED_RADIUS_METERS || 100)
};

try {
  new Intl.DateTimeFormat('en', { timeZone: env.organizationTimezone }).format(new Date());
} catch {
  throw new Error(`Startup blocked: invalid ORGANIZATION_TIMEZONE: ${env.organizationTimezone}`);
}

const requiredEnvironmentVariables = [
  ...(isProduction
    ? [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'CLIENT_ORIGINS',
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
