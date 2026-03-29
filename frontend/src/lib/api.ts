import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({ baseURL: BASE_URL, timeout: 60000 });

const AI_TIMEOUT = 180000;

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 refresh + errors
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh && !error.config?.url?.includes("/auth/refresh")) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refresh,
          });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${data.access_token}`;
            return api(error.config);
          }
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      toast.error("This is taking longer than usual. The server may be waking up — please try again in a moment.");
      return Promise.reject(error);
    }

    const detail = error.response?.data?.detail;
    let msg: string;
    if (Array.isArray(detail)) {
      msg = detail.map((d: { msg?: string }) => d.msg ?? String(d)).join("; ");
    } else if (typeof detail === "string") {
      msg = detail;
    } else if (error.message?.includes("Network Error")) {
      msg = "Unable to reach the server. Please check your connection and try again.";
    } else {
      msg = error.message || "Something went wrong";
    }
    toast.error(msg);
    return Promise.reject(error);
  },
);

/* ---------------------------------------------------------------
   Typed API functions
   --------------------------------------------------------------- */

// Auth
export const authRegister = (email: string, password: string, full_name: string) =>
  api.post("/api/v1/auth/register", { email, password, full_name }).then((r) => r.data);

export const authLogin = (email: string, password: string) =>
  api.post("/api/v1/auth/login", { email, password }).then((r) => r.data);

export const authRefresh = (refresh_token: string) =>
  api.post("/api/v1/auth/refresh", { refresh_token }).then((r) => r.data);

export const authMe = () => api.get("/api/v1/auth/me").then((r) => r.data);

export const authOnboarding = (data: { skills: string[]; interests: string[]; background: string; timeline: string }) =>
  api.put("/api/v1/auth/onboarding", data).then((r) => r.data);

// Sectors
export const fetchSectors = () => api.get("/api/v1/sectors").then((r) => r.data);

export const fetchSector = (id: number) => api.get(`/api/v1/sectors/${id}`).then((r) => r.data);

export const fetchSectorIdeas = (
  id: number,
  sort_by = "probability",
  page = 1,
  per_page = 10,
) =>
  api
    .get(`/api/v1/sectors/${id}/ideas`, { params: { sort_by, page, per_page } })
    .then((r) => r.data);

export const fetchSectorTrends = (id: number) => api.get(`/api/v1/sectors/${id}/trends`).then((r) => r.data);

// Ideas
export const fetchIdea = (id: string) => api.get(`/api/v1/ideas/${id}`).then((r) => r.data);

export const generateIdeas = (data: { skills: string[]; interests: string[]; sector_id?: number; constraints: string }) =>
  api.post("/api/v1/ideas/generate", data, { timeout: AI_TIMEOUT }).then((r) => r.data);

export const analyzeIdea = (data: { idea_description: string; sector_id: number }) =>
  api.post("/api/v1/ideas/analyze", data, { timeout: AI_TIMEOUT }).then((r) => r.data);

export const saveIdea = (idea_id: string, notes?: string) =>
  api.post("/api/v1/ideas/save", { idea_id, notes }).then((r) => r.data);

export const fetchSavedIdeas = () => api.get("/api/v1/ideas/saved/list").then((r) => r.data);

export const unsaveIdea = (savedId: string) => api.delete(`/api/v1/ideas/saved/${savedId}`).then((r) => r.data);

// Visa
export const checkVisaCompliance = (data: { idea_description?: string; analysis_id?: string; sector_id?: number }) =>
  api.post("/api/v1/visa/compliance-check", data, { timeout: AI_TIMEOUT }).then((r) => r.data);

export const generateApplication = (analysis_id: string) =>
  api.post("/api/v1/visa/generate-application", { analysis_id }, { timeout: AI_TIMEOUT }).then((r) => r.data);

export const fetchSuccessStories = (sector_id?: number, limit = 5) =>
  api.get("/api/v1/visa/success-stories", { params: { sector_id, limit } }).then((r) => r.data);

// Funding
export const fetchActiveCompetitions = () => api.get("/api/v1/funding/active-competitions").then((r) => r.data);

export const fetchDeadlines = (days_ahead = 30) =>
  api.get("/api/v1/funding/deadlines", { params: { days_ahead } }).then((r) => r.data);

export const matchFunding = (data: { idea_description?: string; analysis_id?: string }) =>
  api.post("/api/v1/funding/match", data, { timeout: AI_TIMEOUT }).then((r) => r.data);

// Research
export const searchDocuments = (data: { query: string; sector_id?: number; doc_types?: string[]; limit?: number }) =>
  api.post("/api/v1/research/search", data, { timeout: AI_TIMEOUT }).then((r) => r.data);

export const fetchCitation = (doc_id: string) => api.get(`/api/v1/research/citations/${doc_id}`).then((r) => r.data);

// Admin
export const triggerScrape = (job_type: string) =>
  api.post("/api/v1/admin/scrape/trigger", { job_type }).then((r) => r.data);

export const fetchScrapeStatus = () => api.get("/api/v1/admin/scrape/status").then((r) => r.data);

export const fetchAnalytics = () => api.get("/api/v1/admin/analytics").then((r) => r.data);

export default api;
