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

export const formatDate = (value) => {
    if (!value) return "-";
    if (typeof value === "string") {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

export const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

