import api from './axios';

/**
 * Lists job applications with pagination and filters.
 */
export const getApplications = async (params = {}) => {
  const response = await api.get('/hr/applications', { params });
  return response.data?.data ?? response.data;
};

/**
 * Fetches a single job application by ID including candidate, job, email, and audit logs.
 */
export const getApplicationById = async (id) => {
  const response = await api.get(`/hr/applications/${id}`);
  return response.data?.data ?? response.data;
};

/**
 * Creates a job application linking candidate to job.
 */
export const createApplication = async (data) => {
  const response = await api.post('/hr/applications', data);
  return response.data?.data ?? response.data;
};

/**
 * Updates application fields.
 */
export const updateApplication = async (id, data) => {
  const response = await api.put(`/hr/applications/${id}`, data);
  return response.data?.data ?? response.data;
};

/**
 * Updates application status with audit reason.
 */
export const updateApplicationStatus = async (id, status, reason = '') => {
  const response = await api.patch(`/hr/applications/${id}/status`, { status, reason });
  return response.data?.data ?? response.data;
};

/**
 * Creates an application directly from an email workflow.
 */
export const createApplicationFromEmail = async (data) => {
  const response = await api.post('/hr/applications/from-email', data);
  return response.data?.data ?? response.data;
};

/**
 * Fetches audit logs for a specific application.
 */
export const getApplicationAuditLogs = async (id) => {
  const response = await api.get(`/hr/applications/${id}/audit-logs`);
  return response.data?.data ?? response.data;
};
