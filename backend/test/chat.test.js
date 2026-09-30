import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-at-least-32-chars-long';
process.env.ORGANIZATION_TIMEZONE = 'Asia/Kolkata';

const {
  createConversationSchema,
  sendTextMessageSchema,
  sendMediaMessageSchema,
  conversationIdParamSchema
} = await import('../src/validators/chatValidator.js');

const { validateChatMediaUpload } = await import('../src/middleware/uploadMiddleware.js');

test('Chat Validator: Valid Conversation Creation Schema', () => {
  const validPayload = { recipientId: 'c4a66bfb-1346-47e9-bd34-1e5085e5bd3d' };
  const parsed = createConversationSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);
});

test('Chat Validator: Empty Text Message Rejection', () => {
  const emptyPayload = { content: '   ' };
  const parsed = sendTextMessageSchema.safeParse(emptyPayload);
  assert.equal(parsed.success, false);
});

test('Chat Validator: Text Message Over 2000 Chars Rejection', () => {
  const longText = 'a'.repeat(2001);
  const parsed = sendTextMessageSchema.safeParse({ content: longText });
  assert.equal(parsed.success, false);
});

test('Chat Validator: Valid Text Message Parsing', () => {
  const validText = { content: 'Hello team!' };
  const parsed = sendTextMessageSchema.safeParse(validText);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.content, 'Hello team!');
});

test('Chat Validator: Voice Note Duration Over 2 Minutes Rejection', () => {
  const overDuration = { messageType: 'VOICE', duration: '150' };
  const parsed = sendMediaMessageSchema.safeParse(overDuration);
  assert.equal(parsed.success, false);
});

test('Chat Validator: Valid Voice Note Duration Parsing', () => {
  const validVoice = { messageType: 'VOICE', duration: '45' };
  const parsed = sendMediaMessageSchema.safeParse(validVoice);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.duration, 45);
});

test('Chat Upload Middleware: Requires Media File', () => {
  let reqErr = null;
  validateChatMediaUpload({ file: null }, {}, (err) => { reqErr = err; });
  assert.notEqual(reqErr, null);
  assert.equal(reqErr.statusCode, 400);
});

test('Chat Upload Middleware: Rejects Files Exceeding 5MB', () => {
  const largeFile = { size: 6 * 1024 * 1024 }; // 6MB
  let reqErr = null;
  validateChatMediaUpload({ file: largeFile }, {}, (err) => { reqErr = err; });
  assert.notEqual(reqErr, null);
  assert.equal(reqErr.statusCode, 413);
});

test('Chat Upload Middleware: Accepts Valid 3MB File', () => {
  const validFile = { size: 3 * 1024 * 1024 }; // 3MB
  let reqErr = undefined;
  validateChatMediaUpload({ file: validFile }, {}, (err) => { reqErr = err; });
  assert.equal(reqErr, undefined);
});
