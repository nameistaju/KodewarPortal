# Development Bootstrap

The backend has a one-time development bootstrap for local testing.

## How It Works

Bootstrap runs during server startup after MongoDB connects.

It runs only when:

- `NODE_ENV=development`
- `admin@sharpkode.com` does not already exist
- `backend/bootstrap-credentials.json` does not already exist

It never runs in production and it never modifies existing users. Once `admin@sharpkode.com` exists, bootstrap will not recreate or overwrite that administrator.

When it runs, it creates:

- Admin: `admin@sharpkode.com`
- Marketing Employee: `rahulmarketing@sharpkode.com`
- IT Employee: `rahulit@sharpkode.com`

Temporary passwords are generated securely and saved to:

```text
backend/bootstrap-credentials.json
```

This file is ignored by Git and should stay local.

Bootstrap-created users are saved with `mustChangePassword: true`, so their first login is limited to changing the temporary password.

## Retrieve Credentials

Use:

```bash
npm run show-bootstrap-users
```

The startup console also prints:

```text
Bootstrap Users Created

Admin:
admin@sharpkode.com

Marketing Employee:
rahulmarketing@sharpkode.com

IT Employee:
rahulit@sharpkode.com

Credentials saved to:
backend/bootstrap-credentials.json
```

## Disable Bootstrap After Testing

Any one of these disables it:

- Set `NODE_ENV` to anything other than `development`
- Keep `admin@sharpkode.com` in the database
- Keep `backend/bootstrap-credentials.json` in place
- Remove the `runDevelopmentBootstrap()` call from `src/server.js`

For shared development databases, keep `backend/bootstrap-credentials.json` private and do not rerun bootstrap.

## Safely Delete Bootstrap Accounts Before Production

Before deploying production:

1. Confirm `NODE_ENV=production`.
2. Delete the local `backend/bootstrap-credentials.json` file.
3. Remove test users from any non-production database if they were created there:
   - `admin@sharpkode.com`
   - `rahulmarketing@sharpkode.com`
   - `rahulit@sharpkode.com`
4. Verify production MongoDB does not contain bootstrap test accounts.
5. Start production only with real admin accounts and managed secrets.
