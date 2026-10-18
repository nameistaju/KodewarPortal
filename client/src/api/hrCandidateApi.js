import api from './axios';

/**
 * Fetches paginated candidate list with optional search, status, and source filters.
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status]
 * @param {string} [params.source]
 * @param {string} [params.search]
 * @param {string} [params.sortBy='created_at']
 * @param {string} [params.sortOrder='desc']
 * @returns {Promise<{ candidates: Array, pagination: object }>}
 */
export const getCandidates = async (params = {}) => {
  const response = await api.get('/hr/candidates', { params });
  return response.data?.data ?? response.data;
};

/**
 * Fetches a single candidate record by UUID, including linked emails and audit logs.
 * @param {string} id
 * @returns {Promise<object>}
 */
export const getCandidateById = async (id) => {
  const response = await api.get(`/hr/candidates/${id}`);
  return response.data?.data ?? response.data;
};

/**
 * Creates a new candidate profile.
 * @param {object} data
 * @returns {Promise<object>}
 */
export const createCandidate = async (data) => {
  const response = await api.post('/hr/candidates', data);
  return response.data?.data ?? response.data;
};

/**
 * Updates an existing candidate's editable fields.
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export const updateCandidate = async (id, data) => {
  const response = await api.put(`/hr/candidates/${id}`, data);
  return response.data?.data ?? response.data;
};

/**
 * Updates a candidate's pipeline status with an audit reason.
 * @param {string} id
 * @param {string} status
 * @param {string} [reason]
 * @returns {Promise<object>}
 */
export const updateCandidateStatus = async (id, status, reason = '') => {
  const response = await api.patch(`/hr/candidates/${id}/status`, { status, reason });
  return response.data?.data ?? response.data;
};

/**
 * Links a mailbox email to a candidate record.
 * @param {string} candidateId
 * @param {string} emailId
 * @param {object} [options={}]
 * @returns {Promise<object>}
 */
export const linkEmailToCandidate = async (candidateId, emailId, options = {}) => {
  const response = await api.post(`/hr/candidates/${candidateId}/emails`, {
    emailId,
    ...options
  });
  return response.data?.data ?? response.data;
};

/**
 * Removes the linkage between an email and a candidate.
 * @param {string} candidateId
 * @param {string} emailId
 * @returns {Promise<object>}
 */
export const unlinkEmailFromCandidate = async (candidateId, emailId) => {
  const response = await api.delete(`/hr/candidates/${candidateId}/emails/${emailId}`);
  return response.data?.data ?? response.data;
};

/**
 * Creates a candidate profile directly from an incoming mailbox email.
 * @param {object} data
 * @param {string} data.emailId
 * @returns {Promise<object>}
 */
export const createCandidateFromEmail = async (data) => {
  const response = await api.post('/hr/candidates/from-email', data);
  return response.data?.data ?? response.data;
};

/**
 * Fetches audit logs for a specific candidate.
 * @param {string} id
 * @returns {Promise<Array>}
 */
export const getCandidateAuditLogs = async (id) => {
  const response = await api.get(`/hr/candidates/${id}/audit-logs`);
  return response.data?.data ?? response.data;
};
