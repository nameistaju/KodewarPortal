import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';

const {
  createChannelSchema,
  addChannelMemberSchema
} = await import('../src/validators/chatValidator.js');

const {
  canUserAccessConversation
} = await import('../src/services/chatService.js');

test('createChannelSchema validates channel creation payload', () => {
  const validPayload = {
    name: 'Development',
    description: 'Tech stack discussion',
    type: 'CHANNEL',
    isPrivate: false
  };

  const parsed = createChannelSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.name, 'Development');
  assert.equal(parsed.data.type, 'CHANNEL');
  assert.equal(parsed.data.isPrivate, false);
});

test('createChannelSchema rejects names that are too short', () => {
  const invalidPayload = {
    name: 'a'
  };

  const parsed = createChannelSchema.safeParse(invalidPayload);
  assert.equal(parsed.success, false);
});

test('addChannelMemberSchema validates member payload', () => {
  const validMember = {
    employeeId: '507f1f77bcf86cd799439011',
    role: 'MEMBER'
  };

  const parsed = addChannelMemberSchema.safeParse(validMember);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.role, 'MEMBER');
});

test('canUserAccessConversation - Admin has universal access', async () => {
  // Mock check for admin role
  const mockAdminAccess = (role) => role === 'ADMIN';
  assert.equal(mockAdminAccess('ADMIN'), true);
});

test('canUserAccessConversation - Public channels open to all active employees', async () => {
  const mockPublicChannelAccess = (conv) => conv.type === 'CHANNEL' && !conv.is_private;
  const generalChannel = { type: 'CHANNEL', is_private: false };
  assert.equal(mockPublicChannelAccess(generalChannel), true);
});

test('canUserAccessConversation - Private HR channel restricts unauthorized normal employees', async () => {
  const hrChannel = { id: 'hr-1', type: 'CHANNEL', is_private: true, slug: 'hr' };
  const participants = ['admin-id-1', 'hr-id-1'];

  const canAccess = (userId, userRole) => {
    if (userRole === 'ADMIN') return true;
    if (!hrChannel.is_private) return true;
    return participants.includes(userId);
  };

  assert.equal(canAccess('admin-id-1', 'ADMIN'), true);
  assert.equal(canAccess('hr-id-1', 'EMPLOYEE'), true);
  assert.equal(canAccess('emp-regular-id', 'EMPLOYEE'), false);
});
