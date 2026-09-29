import axios from "axios";

const baseUrl = import.meta.env.VITE_BASE_URL;

if (!baseUrl) {
    throw new Error("VITE_BASE_URL is required. Set it to your backend origin, for example https://api.sharpkode.com");
}

const api = axios.create({
    baseURL: `${baseUrl.replace(/\/$/, "")}/api`
})

let refreshPromise = null;

// Attach Auth token to all network requests
api.interceptors.request.use((config)=>{
    const token = localStorage.getItem("token")
    if(token){
        config.headers.Authorization = `Bearer ${token}`
    }
    return config;
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const refreshToken = localStorage.getItem("refreshToken");

        // Refresh an expired access token once. Never retry the refresh request itself.
        if (
            originalRequest?.url?.includes("/auth/refresh") ||
            error.response?.status !== 401 ||
            originalRequest?._retry ||
            !refreshToken
        ) {
            if (originalRequest?.url?.includes("/auth/refresh")) {
                const status = error.response?.status;
                if (status === 401 || status === 403) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("userRole");
                }
            }
            return Promise.reject(error);
        }

        originalRequest._retry = true;
        refreshPromise ||= api.post("/auth/refresh", { refreshToken })
            .then(({ data }) => {
                const payload = data.data || {};
                localStorage.setItem("token", payload.accessToken || payload.token);
                localStorage.setItem("refreshToken", payload.refreshToken);
                return payload.accessToken || payload.token;
            })
            .catch((err) => {
                const status = err.response?.status;
                if (status === 401 || status === 403) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("userRole");
                    window.location.href = "/login";
                }
                throw err;
            })
            .finally(() => {
                refreshPromise = null;
            });

        try {
            const token = await refreshPromise;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
        } catch (err) {
            return Promise.reject(err);
        }
    }
);

export default api
