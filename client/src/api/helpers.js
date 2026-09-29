import toast from 'react-hot-toast';
import axios from 'axios';

export const unwrap = (response) => response.data?.data ?? response.data;

export const unwrapItems = (response) => unwrap(response)?.items ?? [];

export const getErrorMessage = (error) => {
    if (!error) return null;
    if (axios.isCancel(error) || error?.name === "CanceledError" || error?.message === "canceled" || error?.code === "ERR_CANCELED") {
        return null;
    }
    if (error?.config?.url?.includes("favicon") || error?.message?.includes("favicon")) {
        return null;
    }
    if (error?.code === "ECONNABORTED" || error?.message?.includes("aborted")) {
        return null;
    }
    const data = error?.response?.data;
    if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
        return data.details.map(d => d.message).join(', ');
    }
    return data?.message || data?.error || error?.message || "Request failed";
};

export const toastError = (error) => {
    const msg = getErrorMessage(error);
    if (msg) {
        toast.error(msg);
    }
};

export const employeeName = (employee) => employee?.name || "Unknown employee";

export const formatDate = (value) => value ? new Date(value).toLocaleDateString() : "-";

export const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "-";
