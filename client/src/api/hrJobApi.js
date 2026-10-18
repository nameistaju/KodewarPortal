import api from './axios';

/**
 * Lists job requisitions with pagination and filters.
 */
export const getJobs = async (params = {}) => {
  const response = await api.get('/hr/jobs', { params });
  return response.data?.data ?? response.data;
};

/**
 * Fetches a single job requisition by ID.
 */
export const getJobById = async (id) => {
  const response = await api.get(`/hr/jobs/${id}`);
  return response.data?.data ?? response.data;
};

/**
 * Creates a new job requisition.
 */
export const createJob = async (data) => {
  const response = await api.post('/hr/jobs', data);
  return response.data?.data ?? response.data;
};

/**
 * Updates an existing job requisition.
 */
export const updateJob = async (id, data) => {
  const response = await api.put(`/hr/jobs/${id}`, data);
  return response.data?.data ?? response.data;
};

/**
 * Archives a job requisition.
 */
export const archiveJob = async (id) => {
  const response = await api.delete(`/hr/jobs/${id}`);
  return response.data?.data ?? response.data;
};
