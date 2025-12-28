import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

/* REQUEST: enviar token */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* RESPONSE: manejar token caducado */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido o caducado
      localStorage.removeItem("token");

      // Redirigir a login
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
