import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-at-least-32-chars-long';
process.env.ORGANIZATION_TIMEZONE = 'Asia/Kolkata';

const { signAccessToken, signRefreshToken, verifyToken, verifyRefreshToken } = await import('../src/utils/jwt.js');
const { authorizeRoles } = await import('../src/middleware/roleMiddleware.js');
const { validateImageUpload } = await import('../src/middleware/uploadMiddleware.js');

test('JWT Access Token Signing and Verification', () => {
  const dummyUser = { _id: '507f1f77bcf86cd799439011', role: 'ADMIN', tokenVersion: 1 };
  const token = signAccessToken(dummyUser);
  const decoded = verifyToken(token);

  assert.equal(decoded.sub, dummyUser._id);
  assert.equal(decoded.role, dummyUser.role);
  assert.equal(decoded.type, 'access');
  assert.equal(decoded.tokenVersion, 1);
});

test('JWT Refresh Token Signing and Verification', () => {
  const dummyUser = { _id: '507f1f77bcf86cd799439011', tokenVersion: 2 };
  const jti = 'test-jti-123';
  const refreshToken = signRefreshToken(dummyUser, jti);
  const decoded = verifyRefreshToken(refreshToken);

  assert.equal(decoded.sub, dummyUser._id);
  assert.equal(decoded.jti, jti);
  assert.equal(decoded.type, 'refresh');
  assert.equal(decoded.tokenVersion, 2);
});

test('Role Middleware Authorization Enforcement', async () => {
  const adminReq = { user: { role: 'ADMIN' } };
  const employeeReq = { user: { role: 'EMPLOYEE' } };

  let adminPassed = false;
  const adminMiddleware = authorizeRoles('ADMIN');
  adminMiddleware(adminReq, {}, () => { adminPassed = true; });
  assert.equal(adminPassed, true);

  let employeeError = null;
  const employeeMiddleware = authorizeRoles('ADMIN');
  employeeMiddleware(employeeReq, {}, (err) => { employeeError = err; });
  assert.notEqual(employeeError, null);
  assert.equal(employeeError.statusCode, 403);
});

test('Upload Middleware Image Signature Validation', () => {
  const validJpeg = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) };
  const validPng = { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) };
  const invalidFile = { buffer: Buffer.from([0x00, 0x00, 0x00, 0x00]) };

  let nextError = undefined;
  validateImageUpload({ file: validJpeg }, {}, (err) => { nextError = err; });
  assert.equal(nextError, undefined);

  validateImageUpload({ file: validPng }, {}, (err) => { nextError = err; });
  assert.equal(nextError, undefined);

  validateImageUpload({ file: invalidFile }, {}, (err) => { nextError = err; });
  assert.notEqual(nextError, undefined);
  assert.equal(nextError.statusCode, 400);
});
