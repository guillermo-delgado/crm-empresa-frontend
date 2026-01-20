import { useEffect, useState } from "react";
import api from "../../services/api";

type RegistroHoy = {
  estado: "FUERA" | "DENTRO";
  minutosTrabajados: number;
};

export default function ControlHorario() {
  const [registro, setRegistro] = useState<RegistroHoy>({
    estado: "FUERA",
    minutosTrabajados: 0,
  });
  const [horaActual, setHoraActual] = useState(new Date());
  const [loading, setLoading] = useState(true);

  /* ⏱ Reloj en tiempo real */
  useEffect(() => {
    const t = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const cargarEstado = async () => {
    try {
      setLoading(true);
      const res = await api.get("/horario/hoy");

      if (res.data) {
        setRegistro(res.data);
      } else {
        setRegistro({
          estado: "FUERA",
          minutosTrabajados: 0,
        });
      }
    } catch {
      setRegistro({
        estado: "FUERA",
        minutosTrabajados: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

/* 🔘 FICHAR (backend decide entrada/salida) */
const fichar = async () => {
  try {
    const estabaFuera = registro.estado === "FUERA";

    await api.post("/horario/fichar");
    await cargarEstado();

    // 🟢 Si estaba FUERA → acaba de fichar ENTRADA
    if (estabaFuera) {
      localStorage.removeItem("jornada_cerrada");
    }
  } catch (e: any) {
    alert(e.response?.data?.message || "Error al fichar");
  }
};


  const minutosAHoras = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h} h ${m} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cargando…
      </div>
    );
  }

  const enJornada = registro.estado === "DENTRO";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-between px-6 py-10">
      {/* HEADER */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold">
          Control horario
        </h1>
        <p className="text-slate-500 text-sm">
          Hoy · {horaActual.toLocaleDateString("es-ES")}
        </p>
      </div>

      {/* HORA ACTUAL */}
      <div className="text-center">
        <div className="text-6xl font-bold tracking-tight">
          {horaActual.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div className="mt-2 text-sm text-slate-500">
          Hora actual
        </div>
      </div>

      {/* ESTADO */}
      <div className="w-full bg-white rounded-2xl shadow p-6 text-center space-y-3">
        <div className="text-sm text-slate-500">
          Estado
        </div>

        <div
          className={`text-lg font-semibold ${
            enJornada ? "text-green-600" : "text-slate-500"
          }`}
        >
          {enJornada ? "En jornada" : "Fuera de jornada"}
        </div>

        <div className="text-sm text-slate-500">
          Tiempo trabajado hoy
        </div>

        <div className="text-xl font-semibold">
          {minutosAHoras(registro.minutosTrabajados)}
        </div>
      </div>

      {/* BOTÓN PRINCIPAL */}
      <button
  onClick={fichar}
  className={`
    w-full py-5 rounded-2xl text-lg font-semibold text-white
    cursor-pointer
    transition
    active:scale-[0.98]
    ${
      enJornada
        ? "bg-red-600 hover:bg-red-700"
        : "bg-green-600 hover:bg-green-700"
    }
  `}
>

        {enJornada ? "Fichar salida" : "Fichar entrada"}
      </button>
    </div>
  );
}
