import { useEffect, useState } from "react";
import api from "../../services/api";

type RegistroHoy = {
  estado: "FUERA" | "DENTRO";
  minutosTrabajados: number;
  nombre: string;
};



export default function ControlHorario() {
  const [registro, setRegistro] = useState<RegistroHoy>({
  estado: "FUERA",
  minutosTrabajados: 0,
  nombre: "",
});

  const [horaActual, setHoraActual] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);



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
      console.log("REGISTRO HOY:", res.data);


     if (res.data) {
  setRegistro(res.data);

  if (res.data.estado === "DENTRO") {
  const inicioGuardado = localStorage.getItem("hora_inicio_jornada");

  if (!inicioGuardado) {
    // ⏱️ arrancar contador desde AHORA
    localStorage.setItem(
      "hora_inicio_jornada",
      new Date().toISOString()
    );
  }
} else {
  // 🔴 Si está FUERA, limpiar siempre
  localStorage.removeItem("hora_inicio_jornada");
}


  // 🔒 EXTRA: si el backend dice FUERA, limpiar contador
  if (res.data.estado === "FUERA") {
    localStorage.removeItem("hora_inicio_jornada");
  }
return res.data;

} else {
  setRegistro({
    estado: "FUERA",
    minutosTrabajados: 0,
     nombre: "",
  });
}

    } catch {
      setRegistro({
        estado: "FUERA",
        minutosTrabajados: 0,
         nombre: "",
      });
    } finally {
      setLoading(false);
    }
  return null;
};

  useEffect(() => {
    cargarEstado();
  }, []);

/* 🔘 FICHAR (backend decide entrada/salida) */
const fichar = async () => {
  try {
    const estabaFuera = registro.estado === "FUERA";

    await api.post("/horario/fichar");

    const nuevoRegistro = await cargarEstado();
    const nombre = nuevoRegistro?.nombre ?? "";

    if (estabaFuera) {
      const hora = new Date().getHours();
      const saludo = hora < 14 ? "Buenos días" : "Buenas tardes";
      setMensaje(`${saludo}, ${nombre}`);
    } else {
      setMensaje(`Hasta pronto, ${nombre}`);
    }

    setTimeout(() => {
      setMensaje(null);
    }, 10000);

  } catch (e: any) {
    alert(e.response?.data?.message || "Error al fichar");
  }
};







  const minutosAHoras = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h} h ${m} min`;
  };

//   const obtenerSaludo = (nombre: string) => {
//   const hora = new Date().getHours();
//   const saludo = hora < 14 ? "Buenos días" : "Buenas tardes";
//   return `${saludo}, ${nombre}`;
// };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cargando…
      </div>
    );
  }

  const enJornada = registro.estado === "DENTRO";


  const calcularMinutosEnVivo = () => {
  if (registro.estado !== "DENTRO") {
    return registro.minutosTrabajados;
  }

  const inicio = localStorage.getItem("hora_inicio_jornada");
  if (!inicio) return registro.minutosTrabajados;

  const inicioDate = new Date(inicio);
  const ahora = horaActual;

  const diffMs = ahora.getTime() - inicioDate.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  return registro.minutosTrabajados + diffMin;
};

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


{mensaje && (
  <div className="text-center mb-8 transition-opacity duration-500">
   <div className="
  text-2xl md:text-3xl
  font-medium
  tracking-tight
  text-slate-700
  drop-shadow-sm
">
  {mensaje}
</div>

    
  </div>
)}


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
  {minutosAHoras(calcularMinutosEnVivo())}
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
