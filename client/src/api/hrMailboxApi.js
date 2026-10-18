import api from './axios';

/**
 * Fetches paginated emails for the HR workspace with optional search and filters.
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.folder='INBOX']
 * @param {string} [params.search]
 * @param {string} [params.processingStatus]
 * @returns {Promise<{ emails: Array, pagination: object }>}
 */
export const getMailboxEmails = async (params = {}) => {
  const response = await api.get('/hr-mailbox/emails', { params });
  return response.data?.data ?? response.data;
};

/**
 * Fetches a single email by UUID, including full body text and HTML.
 * @param {string} id
 * @returns {Promise<object>}
 */
export const getMailboxEmailById = async (id) => {
  const response = await api.get(`/hr-mailbox/emails/${id}`);
  return response.data?.data ?? response.data;
};

/**
 * Fetches current mailbox synchronization status and checkpoints.
 * @returns {Promise<object>}
 */
export const getMailboxSyncStatus = async () => {
  const response = await api.get('/hr-mailbox/status');
  return response.data?.data ?? response.data;
};

/**
 * Updates an email's category with an HR manual override.
 * @param {string} id
 * @param {string} category
 * @returns {Promise<object>}
 */
export const updateMailboxEmailCategory = async (id, category) => {
  const response = await api.patch(`/hr-mailbox/emails/${id}/category`, { category });
  return response.data?.data ?? response.data;
};

