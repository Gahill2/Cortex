import axios from "axios";
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
export const api = axios.create({
    baseURL
});
export const setAuthToken = (token) => {
    if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    else {
        delete api.defaults.headers.common.Authorization;
    }
};
export const enrichTask = async (title) => {
    const res = await api.post("/cortex/ai/tasks/enrich", { title });
    return res.data.data.description;
};
