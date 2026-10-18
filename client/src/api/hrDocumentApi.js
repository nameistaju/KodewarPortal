import api from './axios';

/**
 * Fetches paginated document review queue.
 * @param {object} params
 * @returns {Promise<{ documents: Array, pagination: object }>}
 */
export const getDocuments = async (params = {}) => {
  const response = await api.get('/hr/documents', { params });
  return response.data?.data ?? response.data;
};

/**
 * Fetches a single document record by UUID with email context and audit trail.
 * @param {string} id
 * @returns {Promise<object>}
 */
export const getDocumentById = async (id) => {
  const response = await api.get(`/hr/documents/${id}`);
  return response.data?.data ?? response.data;
};

/**
 * Updates a document's review decision (Accepted, Rejected, More Info, etc.) and notes.
 * @param {string} id
 * @param {object} data - { status, category, reviewNotes, candidateId }
 * @returns {Promise<object>}
 */
export const updateDocumentReview = async (id, data) => {
  const response = await api.patch(`/hr/documents/${id}/review`, data);
  return response.data?.data ?? response.data;
};

/**
 * Links or unlinks a document to a persistent candidate profile.
 * @param {string} id
 * @param {string|null} candidateId
 * @returns {Promise<object>}
 */
export const linkDocumentToCandidate = async (id, candidateId) => {
  const response = await api.patch(`/hr/documents/${id}/link-candidate`, { candidateId });
  return response.data?.data ?? response.data;
};

/**
 * Synchronizes attachment metadata from hr_emails table.
 * @returns {Promise<object>}
 */
export const syncDocumentMetadata = async () => {
  const response = await api.post('/hr/documents/sync-metadata');
  return response.data?.data ?? response.data;
};
