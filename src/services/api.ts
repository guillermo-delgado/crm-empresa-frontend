import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/* =========================
   REQUEST → añadir token
========================= */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* =========================
   RESPONSE → token caducado
========================= */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      // 🔥 TOKEN INVÁLIDO O CADUCADO
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // 🚫 no navigate, no React Router
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
