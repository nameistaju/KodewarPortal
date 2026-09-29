# SharpKode Workforce API Summary

Base URL: `https://api.sharpkode.com/api`

All protected routes require:

```http
Authorization: Bearer <accessToken>
```

## Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/reset-password/:employeeId`

Login responses include `mustChangePassword`. When it is `true`, clients must send the user to the password change flow and block all other application screens until `POST /auth/change-password` succeeds.

## Employees

- `GET /employees`
- `POST /employees`
- `GET /employees/:employeeId`
- `PATCH /employees/:employeeId`
- `POST /employees/:employeeId/activate`
- `POST /employees/:employeeId/deactivate`
- `POST /employees/:employeeId/reset-password`
- `GET /employees/me/profile`
- `PATCH /employees/me/profile`

## Attendance

- `GET /attendance/settings`
- `PUT /attendance/settings`
- `POST /attendance/punch-in`
- `POST /attendance/punch-out`
- `GET /attendance/history`
- `GET /attendance/monthly-summary`

## Attendance Corrections

- `POST /attendance-corrections`
- `GET /attendance-corrections`
- `POST /attendance-corrections/:correctionId/approve`
- `POST /attendance-corrections/:correctionId/reject`

## Leaves

- `POST /leaves`
- `GET /leaves`
- `POST /leaves/:leaveId/cancel`
- `POST /leaves/:leaveId/approve`
- `POST /leaves/:leaveId/reject`

## Holidays

- `GET /holidays`
- `POST /holidays`
- `PATCH /holidays/:holidayId`
- `DELETE /holidays/:holidayId`

## Announcements

- `GET /announcements`
- `POST /announcements`
- `PATCH /announcements/:announcementId`
- `DELETE /announcements/:announcementId`

## Clients

- `GET /clients`
- `POST /clients`
- `GET /clients/:clientId`
- `PATCH /clients/:clientId`
- `DELETE /clients/:clientId`

## Client Activities

- `POST /client-activities`
- `GET /client-activities/feed`
- `GET /client-activities/client/:clientId/timeline`

## Client Visits

- `POST /client-visits`
- `GET /client-visits`
- `GET /client-visits/reports`

## Dashboards

- `GET /dashboard/admin`
- `GET /dashboard/employee`

## Query Standards

List endpoints support:

- `page`
- `limit`
- `sort`
- module-specific filters
- `search` where relevant

Response format:

```json
{
  "success": true,
  "message": "Resource fetched successfully",
  "data": {}
}
```

Error format:

```json
{
  "success": false,
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "A valid email is required"
    }
  ]
}
```
