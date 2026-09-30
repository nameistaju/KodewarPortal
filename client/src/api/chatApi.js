import api from './axios';
import { unwrap } from './helpers';

export const getConversations = async () => {
  const response = await api.get('/chat/conversations');
  return unwrap(response);
};

export const createConversation = async (recipientId) => {
  const response = await api.post('/chat/conversations', { recipientId });
  return unwrap(response);
};

export const getMessages = async (conversationId, page = 1, limit = 30) => {
  const response = await api.get(`/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  return unwrap(response);
};

export const sendTextMessage = async (conversationId, content) => {
  const response = await api.post(`/chat/conversations/${conversationId}/messages`, { content });
  return unwrap(response);
};

export const sendMediaMessage = async (conversationId, file, messageType = 'IMAGE', content = '', duration = 0) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('messageType', messageType);
  if (content) formData.append('content', content);
  if (duration) formData.append('duration', String(duration));

  const response = await api.post(`/chat/conversations/${conversationId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return unwrap(response);
};
