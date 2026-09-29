# SharpKode Workforce Auth API

Base URL: `http://localhost:5000/api/auth`

All protected endpoints require:

```http
Authorization: Bearer <jwt_token>
```

## Login

`POST /login`

Request:

```json
{
  "email": "rahulMarketing@sharpkode.com",
  "password": "<password>"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt_token>",
    "role": "EMPLOYEE",
    "user": {
      "_id": "665f1b2c7c5d8a001274abcd",
      "name": "Rahul Marketing",
      "phone": "+91 9876543210",
      "email": "rahulMarketing@sharpkode.com",
      "department": "MARKETING",
      "dob": "1995-01-01T00:00:00.000Z",
      "joinDate": "2026-06-03T00:00:00.000Z",
      "role": "EMPLOYEE",
      "status": "ACTIVE",
      "forcePasswordChange": true,
      "mustChangePassword": true
    }
  }
}
```

If `mustChangePassword` is `true`, the frontend must redirect the user to the password change screen and block access to the rest of the application until the password is changed.

## Logout

`POST /logout`

This invalidates the current token family by incrementing the user's token version.

Response:

```json
{
  "success": true,
  "message": "Logout successful"
}
```

## Get Current User

`GET /me`

Response:

```json
{
  "success": true,
  "message": "Current user fetched successfully",
  "data": {
    "user": {
      "_id": "665f1b2c7c5d8a001274abcd",
      "name": "Rahul Marketing",
      "phone": "+91 9876543210",
      "email": "rahulMarketing@sharpkode.com",
      "department": "MARKETING",
      "role": "EMPLOYEE",
      "status": "ACTIVE",
      "forcePasswordChange": false,
      "mustChangePassword": false
    }
  }
}
```

## Change Password

`POST /change-password`

Request:

```json
{
  "currentPassword": "<current-password>",
  "newPassword": "<new-strong-password>"
}
```

Response:

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "token": "<new_jwt_token>",
    "role": "EMPLOYEE",
    "user": {
      "_id": "665f1b2c7c5d8a001274abcd",
      "email": "rahulMarketing@sharpkode.com",
      "role": "EMPLOYEE",
      "forcePasswordChange": false,
      "mustChangePassword": false
    }
  }
}
```

Successful password changes set both `mustChangePassword` and `forcePasswordChange` to `false` and issue a fresh access/refresh token pair.

## Admin Reset Employee Password

`POST /reset-password/:employeeId`

Admin only.

Request with generated temporary password:

```json
{}
```

Request with explicit temporary password:

```json
{
  "newPassword": "TempPass@2026"
}
```

Response:

```json
{
  "success": true,
  "message": "Employee password reset successfully",
  "data": {
    "employee": {
      "_id": "665f1b2c7c5d8a001274abcd",
      "email": "rahulMarketing@sharpkode.com",
      "role": "EMPLOYEE",
      "forcePasswordChange": true,
      "mustChangePassword": true
    },
    "temporaryPassword": "<generated-temporary-password>"
  }
}
```

## Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "details": [
    {
      "field": "newPassword",
      "message": "Password must include uppercase, lowercase, number, and special character"
    }
  ]
}
```
