import * as chatService from '../services/chatService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getConversations = catchAsync(async (req, res) => {
  const currentUserId = req.user._id || req.user.id;
  const conversations = await chatService.getUserConversations(currentUserId);
  sendSuccess(res, 200, 'Conversations fetched successfully', { conversations });
});

export const createConversation = catchAsync(async (req, res) => {
  const currentUserId = req.user._id || req.user.id;
  const recipientId = req.body.recipientId || req.body.employeeId;
  const conversation = await chatService.getOrCreateDirectConversation(currentUserId, recipientId);
  sendSuccess(res, 201, 'Conversation retrieved or created successfully', { conversation });
});

export const createChannel = catchAsync(async (req, res) => {
  const conversation = await chatService.createChannel(req.user, req.body);
  sendSuccess(res, 201, 'Channel or group created successfully', { conversation });
});

export const addChannelMember = catchAsync(async (req, res) => {
  const conversation = await chatService.addChannelMember(
    req.user,
    req.params.id || req.params.conversationId,
    req.body.employeeId,
    req.body.role || 'MEMBER'
  );
  sendSuccess(res, 200, 'Member added successfully', { conversation });
});

export const removeChannelMember = catchAsync(async (req, res) => {
  const result = await chatService.removeChannelMember(
    req.user,
    req.params.id || req.params.conversationId,
    req.params.employeeId
  );
  sendSuccess(res, 200, 'Member removed successfully', result);
});

export const getMessages = catchAsync(async (req, res) => {
  const currentUserId = req.user._id || req.user.id;
  const result = await chatService.getConversationMessages(
    req.params.conversationId,
    currentUserId,
    req.validatedQuery || req.query
  );
  sendSuccess(res, 200, 'Messages fetched successfully', result);
});

export const sendTextMessage = catchAsync(async (req, res) => {
  const currentUserId = req.user._id || req.user.id;
  const message = await chatService.sendTextMessage(
    req.params.conversationId,
    currentUserId,
    req.body.content
  );
  sendSuccess(res, 201, 'Message sent successfully', { message });
});

export const sendMediaMessage = catchAsync(async (req, res) => {
  const currentUserId = req.user._id || req.user.id;
  const message = await chatService.sendMediaMessage(
    req.params.conversationId,
    currentUserId,
    req.file,
    req.body
  );
  sendSuccess(res, 201, 'Media message sent successfully', { message });
});

export const triggerCleanup = catchAsync(async (_req, res) => {
  const result = await chatService.cleanupExpiredMessages();
  sendSuccess(res, 200, 'Expired messages cleanup completed', result);
});
