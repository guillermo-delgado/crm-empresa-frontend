import { useEffect, useState } from "react";
import api from "../../../services/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  CalendarDays,
  Users,
  Trash2,
  Plane,
  Briefcase,
  Ban,
  X,
} from "lucide-react";
const formatFechaES = (fecha: string) => {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};


/* =========================
   TIPOS
========================= */
type Empleado = {
  _id: string;
  nombre: string;
  apellidos?: string;
};

type DiaCalendario = {
  fecha: string;
  estado: "VACACIONES" | "DIA_LIBRE" | "BAJA" | "FESTIVO" | null;
  minutosTrabajados: number;
  turno?: "MANANA" | "TARDE" | "MANANA_TARDE" | null;

  horaEntradaManana?: string | null;
  horaSalidaManana?: string | null;
  horaEntradaTarde?: string | null;
  horaSalidaTarde?: string | null;
};




type RespuestaHorario = {
  dias: DiaCalendario[];
  horasTrabajadas: number; 
  balanceMinutos: number;
  horasContratadasSemana: number;
  maxDiasVacaciones: number;
};


/* =========================
   COMPONENTE
========================= */
export default function HorarioCRM() {
 /* =========================
   ESTADO
========================= */
const [empleados, setEmpleados] = useState<Empleado[]>([]);
const [empleadoId, setEmpleadoId] = useState<string>("ALL");

const [mes, setMes] = useState(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

const [dias, setDias] = useState<DiaCalendario[]>([]);
const [horasTrabajadas, setHorasTrabajadas] = useState<number>(0);
const [balanceMinutos, setBalanceMinutos] = useState<number>(0);
const [modoModal, setModoModal] = useState<"ACCIONES" | "JORNADAS" | null>(null);





// const [minutosDia, setMinutosDia] = useState<number>(0);

const [horasContratadasSemana, setHorasContratadasSemana] =
  useState<number>(40);
const [maxDiasVacaciones, setMaxDiasVacaciones] =
  useState<number>(30);

const [mostrarConfig, setMostrarConfig] = useState<boolean>(false);

const [diaActivo, setDiaActivo] =
  useState<DiaCalendario | null>(null);
const [horasManana, setHorasManana] = useState({
  entrada: "",
  salida: "",
});

const [jornadaManana, setJornadaManana] = useState({
  entrada: "",
  salida: "",
});

const [jornadaTarde, setJornadaTarde] = useState({
  entrada: "",
  salida: "",
});



const [horasTarde, setHorasTarde] = useState({
  entrada: "",
  salida: "",
});



const [loading, setLoading] = useState<boolean>(false);

/* =========================
   GUARDAR CONFIGURACIÓN
========================= */
const guardarConfiguracion = async () => {
  if (empleadoId === "ALL") return;

  await api.put(`/users/${empleadoId}/config`, {
    horasContratadasSemana,
    maxDiasVacaciones,
  });

  setMostrarConfig(false);
};



  /* =========================
     CARGAR EMPLEADOS (DB)
  ========================= */
 useEffect(() => {
  api
    .get("/crm/horario/empleados") // ✅ ENDPOINT REAL
    .then((res) => {
      setEmpleados(res.data);
    })
    .catch((err) => {
      console.error("ERROR USERS", err.response?.status);
      setEmpleados([]);
    });
}, []);

/* =========================
   CARGAR CONFIGURACIÓN EMPLEADO
========================= */
useEffect(() => {
  if (empleadoId === "ALL") {
    setHorasContratadasSemana(40);
    setMaxDiasVacaciones(30);
    return;
  }

  api
    .get(`/users/${empleadoId}`)
    .then((res) => {
      setHorasContratadasSemana(
        res.data.horasContratadasSemana ?? 40
      );
      setMaxDiasVacaciones(
        res.data.maxDiasVacaciones ?? 30
      );
    })
    .catch(() => {
      setHorasContratadasSemana(40);
      setMaxDiasVacaciones(30);
    });
}, [empleadoId]);


  /* =========================
     CARGAR HORARIO (DB)
  ========================= */
  const cargarHorario = () => {
  setLoading(true);

  // 🔴 CALENDARIO GENERAL
  if (empleadoId === "ALL") {
    api
      .get("/crm/horario/calendario-general", {
        params: { mes },
      })
      .then((res) => {
        setDias(
          res.data.dias.map((d: any) => ({
            fecha: d.fecha,
            estado: d.estado ?? d.tipo ?? null,
            minutosTrabajados: 0,
            turno: null,
          }))
        );

        setHorasTrabajadas(0);
        setBalanceMinutos(0);
      })
      .finally(() => setLoading(false));

    return;
  }

  // 🟢 CALENDARIO DE EMPLEADO
  api
    .get<RespuestaHorario>("/crm/horario", {
      params: {
        mes,
        empleadoId,
      },
    })
    .then((res) => {
      setDias(res.data.dias);
      setHorasTrabajadas(res.data.horasTrabajadas);
      setHorasContratadasSemana(res.data.horasContratadasSemana);
      setMaxDiasVacaciones(res.data.maxDiasVacaciones);
      setBalanceMinutos(res.data.balanceMinutos);
    })
    .catch(() => {
      setDias([]);
      setHorasTrabajadas(0);
    })
    .finally(() => setLoading(false));
};


  useEffect(() => {
    cargarHorario();
  }, [mes, empleadoId]);

  /* =========================
     ACCIONES CALENDARIO
  ========================= */
const marcarDia = async (
  estado: "VACACIONES" | "DIA_LIBRE" | "BAJA" | "FESTIVO" | null,
  turno?: "MANANA" | "TARDE" | "MANANA_TARDE"
) => {
  if (!diaActivo) return;

  // 🟥 BOTONES DE ESTADO → GUARDAR DIRECTO
  if (estado) {
    await api.post("/crm/horario/dia", {
      fecha: diaActivo.fecha,
      empleadoId: empleadoId === "ALL" ? null : empleadoId,
      estado,
      turno: null,
      horasManana: null,
      horasTarde: null,
    });

    setDiaActivo(null);
    setModoModal(null);
    cargarHorario();
    return;
  }

  // 🟩 BOTONES DE TURNO → SOLO SELECCIÓN (NO GUARDA)
  setDiaActivo({
    ...diaActivo,
    estado: null,
    turno: turno ?? null,
  });
};




  const guardarHorario = async () => {
  if (!diaActivo) return;

 await api.post("/crm/horario/dia", {
  fecha: diaActivo.fecha,
  empleadoId: empleadoId === "ALL" ? null : empleadoId,

  // 👇 SOLO UNO DE LOS DOS
  estado: diaActivo.estado ?? null,
  turno: diaActivo.estado ? null : diaActivo.turno,

  horasManana:
    diaActivo.estado
      ? null
      : diaActivo.turno === "MANANA" || diaActivo.turno === "MANANA_TARDE"
      ? horasManana
      : null,

  horasTarde:
    diaActivo.estado
      ? null
      : diaActivo.turno === "TARDE" || diaActivo.turno === "MANANA_TARDE"
      ? horasTarde
      : null,
});


  setDiaActivo(null);
  cargarHorario();
};

const eliminarMarca = async () => {
  if (!diaActivo) return;

  await api.delete("/crm/horario/dia", {
    data: {
      fecha: diaActivo.fecha,
      empleadoId: empleadoId === "ALL" ? null : empleadoId,
    },
  });

  setDiaActivo(null);
  cargarHorario();
};




/* =========================
   HELPERS
========================= */

/* 📅 CALENDARIO */
const getOffsetMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay(); // 0 = domingo
  return firstDay === 0 ? 6 : firstDay - 1; // lunes = 0
};

const diasDelMes = (() => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
})();

const normalizarFecha = (fecha: string) => {
  const [y, m, d] = fecha.split("-");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

const obtenerDia = (n: number) =>
  dias.find((d) =>
    normalizarFecha(d.fecha).endsWith(`-${String(n).padStart(2, "0")}`)
  );

const offset = getOffsetMes(mes);
const balanceHoras = Math.floor(balanceMinutos / 60);

const esFinDeSemana = (fecha: string) => {
  const d = new Date(fecha);
  const day = d.getDay();
  return day === 0 || day === 6;
};

/* ⏱️ TIEMPO */
const calcularMinutos = (entrada: string, salida: string) => {
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
};

/* 🎯 OBJETIVO DIARIO (CLAVE) */
const calcularObjetivoDia = (dia: DiaCalendario) => {
  // 🟢 MAÑANA + TARDE CON HORAS MANUALES (PRIORIDAD MÁXIMA)
  if (
    dia.horaEntradaManana &&
    dia.horaSalidaManana &&
    dia.horaEntradaTarde &&
    dia.horaSalidaTarde
  ) {
    return (
      calcularMinutos(dia.horaEntradaManana, dia.horaSalidaManana) +
      calcularMinutos(dia.horaEntradaTarde, dia.horaSalidaTarde)
    );
  }

  // 🟢 SOLO MAÑANA MANUAL
  if (dia.horaEntradaManana && dia.horaSalidaManana) {
    return calcularMinutos(
      dia.horaEntradaManana,
      dia.horaSalidaManana
    );
  }

  // 🟢 SOLO TARDE MANUAL
  if (dia.horaEntradaTarde && dia.horaSalidaTarde) {
    return calcularMinutos(
      dia.horaEntradaTarde,
      dia.horaSalidaTarde
    );
  }

  // 🟡 Fallback por turno
  if (dia.turno === "MANANA") return 240;
  if (dia.turno === "TARDE") return 240;
  if (dia.turno === "MANANA_TARDE") return 480;

  // 🔴 Último recurso: reparto semanal
  const diasLaborables = 5;
  return Math.round((horasContratadasSemana * 60) / diasLaborables);
};


/* ➕➖ BALANCE DIARIO */
const calcularBalanceDia = (dia: DiaCalendario) => {
  // ⛔ Sin turno, no hay balance
  if (!dia.turno) return null;

  // ⛔ Sin fichajes reales, no hay balance
  if (!dia.minutosTrabajados || dia.minutosTrabajados === 0) {
    return null;
  }

  const minutosObjetivo = calcularObjetivoDia(dia);
  return dia.minutosTrabajados - minutosObjetivo;
};


/* 🧾 FORMATO */
const formatearBalance = (minutos: number) => {
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;

  if (h > 0) {
    return `${minutos > 0 ? "+" : "-"}${h}h ${m}min`;
  }

  return `${minutos > 0 ? "+" : "-"}${m}min`;
};

/* 🔄 NAVEGACIÓN */
const cambiarMes = (delta: number) => {
  const [y, m] = mes.split("-").map(Number);
  const fecha = new Date(y, m - 1 + delta, 1);

  const nuevoMes = `${fecha.getFullYear()}-${String(
    fecha.getMonth() + 1
  ).padStart(2, "0")}`;

  setMes(nuevoMes);
};


  /* =========================
     RENDER
  ========================= */
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <CalendarDays size={22} />
        Gestión de empleados
      </h1>

      {/* SELECTORES */}
<div className="flex flex-wrap items-center gap-4">
  <div className="flex items-center gap-2">
    <Users size={18} />
    <select
      value={empleadoId}
      onChange={(e) => {
        setEmpleadoId(e.target.value);
        setMostrarConfig(false);
      }}
      className="border rounded-lg px-3 py-2 bg-white"
    >
      <option value="ALL">Todos los empleados</option>
      {empleados.map((e) => (
        <option key={e._id} value={e._id}>
          {e.nombre} {e.apellidos ?? ""}
        </option>
      ))}
    </select>
  </div>

 <div className="flex items-center gap-2">
  <button
    onClick={() => cambiarMes(-1)}
    className="p-2 rounded-lg border bg-white hover:bg-slate-50 transition"
    title="Mes anterior"
  >
    <ChevronLeft size={18} />
  </button>

  <input
    type="month"
    value={mes}
    onChange={(e) => setMes(e.target.value)}
    className="border rounded-lg px-3 py-2 bg-white"
  />

  <button
    onClick={() => cambiarMes(1)}
    className="p-2 rounded-lg border bg-white hover:bg-slate-50 transition"
    title="Mes siguiente"
  >
    <ChevronRight size={18} />
  </button>
</div>


  {empleadoId !== "ALL" && (
    <button
      onClick={() => setMostrarConfig((v) => !v)}
      className="ml-auto border rounded-lg px-4 py-2 text-sm bg-white hover:bg-slate-50"
    >
      Editar empleado
    </button>
  )}
</div>



      {/* RESUMEN */}
      <div className="grid grid-cols-4 gap-4 bg-white rounded-xl shadow p-4">
  <Resumen
    titulo="Horas contratadas / semana"
    valor={
      empleadoId === "ALL"
        ? "-"
        : `${horasContratadasSemana} h`
    }
  />

  <Resumen
    titulo="Horas trabajadas"
    valor={
      empleadoId === "ALL"
        ? "-"
        : `${Math.floor(horasTrabajadas / 60)} h ${
            horasTrabajadas % 60
          } min`
    }
  />

  <Resumen
    titulo="Balance"
    valor={empleadoId === "ALL" ? "-" : `${balanceHoras} h`}
    highlight={empleadoId !== "ALL" && balanceHoras < 0}
  />

  <Resumen
    titulo="Máx. vacaciones"
    valor={
      empleadoId === "ALL"
        ? "-"
        : `${maxDiasVacaciones} días`
    }
  />
</div>





      {/* CALENDARIO */}
<div className="grid grid-cols-7 gap-3 text-center text-sm">

  {/* CABECERA DÍAS DE LA SEMANA */}
  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
    <div key={d} className="font-medium text-slate-500">
      {d}
    </div>
  ))}

  {/* HUECOS INICIALES DEL MES */}
  {Array.from({ length: offset }).map((_, i) => (
    <div key={`empty-${i}`} />
  ))}

  {/* DÍAS DEL MES */}
  {Array.from({ length: diasDelMes }, (_, i) => {
    const n = i + 1;
    const dia = obtenerDia(n);

    return (
      <div key={n} className="relative group">
 <button
  onClick={() => {
  setDiaActivo({
    fecha: `${mes}-${String(n).padStart(2, "0")}`,
    estado: dia?.estado ?? null,
    minutosTrabajados: dia?.minutosTrabajados ?? 0,
    turno: dia?.turno ?? null,
    horaEntradaManana: dia?.horaEntradaManana ?? null,
    horaSalidaManana: dia?.horaSalidaManana ?? null,
    horaEntradaTarde: dia?.horaEntradaTarde ?? null,
    horaSalidaTarde: dia?.horaSalidaTarde ?? null,
  });

  // ⬇️ ESTA LÍNEA ES LA CLAVE Y NO ROMPE NADA
  if (empleadoId === "ALL" && !modoModal) {
    setModoModal("ACCIONES");
  }
}}

  className={`
    h-24
    w-full
    cursor-pointer
    rounded-lg
    border
    flex flex-col
    justify-between
    items-center
    px-1
    py-1
    font-semibold
    transition
    overflow-hidden
    ${
      dia?.estado === "VACACIONES"
        ? "bg-blue-100 border-blue-400"
        : dia?.estado === "BAJA"
        ? "bg-red-100 border-red-400"
        : dia?.estado === "FESTIVO"
        ? "bg-purple-100 border-purple-400"
        : dia?.estado === "DIA_LIBRE" &&
          !esFinDeSemana(`${mes}-${String(n).padStart(2, "0")}`)
        ? "bg-orange-100 border-orange-400"
        : esFinDeSemana(`${mes}-${String(n).padStart(2, "0")}`)
        ? "bg-slate-100 border-slate-300"
        : "bg-white"
    }
    hover:shadow-sm
  `}
>
  {/* NÚMERO DEL DÍA */}
  <div className="text-base leading-none">{n}</div>

  {/* CONTENIDO CENTRAL */}
  <div className="flex flex-col items-center gap-[2px] text-center flex-1 overflow-hidden">
    {/* HORAS TRABAJADAS */}
    {empleadoId !== "ALL" && dia && dia.minutosTrabajados > 0 && (
      <div className="text-[11px] text-slate-600 font-medium">
        {Math.floor(dia.minutosTrabajados / 60)}h{" "}
        {dia.minutosTrabajados % 60}m
      </div>
    )}

    {/* TURNO */}
    {dia?.turno && (
      <div className="px-2 py-[2px] rounded-full text-[10px] font-semibold bg-white/70 text-slate-800">
        {dia.turno === "MANANA" && "Mañana"}
        {dia.turno === "TARDE" && "Tarde"}
        {dia.turno === "MANANA_TARDE" && "Mañana / Tarde"}
      </div>
    )}

    {/* HORARIOS */}
    {dia?.turno === "MANANA" &&
      dia.horaEntradaManana &&
      dia.horaSalidaManana && (
        <div className="text-[11px] text-slate-600">
          {dia.horaEntradaManana} - {dia.horaSalidaManana}
        </div>
      )}

    {dia?.turno === "TARDE" &&
      dia.horaEntradaTarde &&
      dia.horaSalidaTarde && (
        <div className="text-[11px] text-slate-600">
          {dia.horaEntradaTarde} - {dia.horaSalidaTarde}
        </div>
      )}

    {dia?.turno === "MANANA_TARDE" && (
      <div className="text-[11px] text-slate-600 leading-tight">
        {dia.horaEntradaManana} - {dia.horaSalidaManana}
        <br />
        {dia.horaEntradaTarde} - {dia.horaSalidaTarde}
      </div>
    )}
  </div>

  {/* OK / + / - (SIEMPRE VISIBLE) */}
  {empleadoId !== "ALL" && dia && dia.turno && (
    (() => {
      const balance = calcularBalanceDia(dia);
      if (balance === null) return null;

      return (
        <div
          className={`text-[11px] font-semibold leading-none mt-auto ${
            balance > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          {balance === 0 ? "OK" : formatearBalance(balance)}
        </div>
      );
    })()
  )}
</button>


  {/* HOVER ACCIONES */}
  {empleadoId !== "ALL" && (
  <div
    className="
      absolute inset-0
      bg-black/50
      opacity-0 group-hover:opacity-100
      transition
      flex items-center justify-center
      rounded-lg
      overflow-hidden
      z-10
    "
  >
    <div
      className="
        flex flex-col
        gap-1
        w-full
        px-2
      "
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setModoModal("JORNADAS");
          setDiaActivo(dia ?? null);
        }}
        className="
          text-[11px]
          py-1
          rounded-md
          bg-white
          hover:bg-slate-100
          cursor-pointer
          w-full
        "
      >
        Jornadas
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setModoModal("ACCIONES");
          setDiaActivo(dia ?? null);
        }}
        className="
          text-[11px]
          py-1
          rounded-md
          bg-white
          hover:bg-slate-100
          cursor-pointer
          w-full
        "
      >
        Acciones
      </button>
    </div>
  </div>
)}

</div>

    );
  })}
</div>


      {mostrarConfig && empleadoId !== "ALL" && (
  <div className="mt-6 bg-white rounded-xl shadow p-6 space-y-4">
    <h3 className="font-semibold text-lg">
      Configuración del empleado
    </h3>

    <div className="grid grid-cols-2 gap-6">
      <div>
        <label className="text-sm text-slate-500">
          Horas contratadas / semana
        </label>
        <input
          type="number"
          value={horasContratadasSemana}
          onChange={(e) =>
            setHorasContratadasSemana(Number(e.target.value) || 0)
          }
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm text-slate-500">
          Máx. días de vacaciones
        </label>
        <input
          type="number"
          value={maxDiasVacaciones}
          onChange={(e) =>
            setMaxDiasVacaciones(Number(e.target.value) || 0)
          }
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-4">
      <button
        onClick={() => setMostrarConfig(false)}
        className="text-sm text-slate-500"
      >
        Cancelar
      </button>

      <button
        onClick={guardarConfiguracion}
        className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm"
      >
        Guardar cambios
      </button>
    </div>
  </div>
)}



      {/* MODAL */}
     {diaActivo && modoModal === "ACCIONES" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold tracking-tight">
  {formatFechaES(diaActivo.fecha)}
</h2>

              <button onClick={() => setDiaActivo(null)}>
                <X />
              </button>
            </div>
<div className="text-sm text-slate-500">
  Asignar turno y estado del día
</div>

{empleadoId === "ALL" && (
  <div className="text-sm text-red-500">
    Selecciona un empleado para asignar turnos o estados
  </div>
)}


<div className="grid grid-cols-3 gap-3 mt-2 mb-4">
  <button
    onClick={() => marcarDia(diaActivo.estado ?? null, "MANANA")}

    className="
      border rounded-xl px-3 py-2 text-sm font-medium
      hover:bg-slate-50 active:scale-[0.97]
      transition shadow-sm cursor-pointer
    "
  >
    Mañana
  </button>

  <button
    onClick={() => marcarDia(diaActivo.estado ?? null, "TARDE")}

    className="
      border rounded-xl px-3 py-2 text-sm font-medium
      hover:bg-slate-50 active:scale-[0.97]
      transition shadow-sm cursor-pointer
    "
  >
    Tarde
  </button>

  <button
    onClick={() => marcarDia(diaActivo.estado ?? null, "MANANA_TARDE")}

    className="
      border rounded-xl px-3 py-2 text-sm font-medium
      hover:bg-slate-50 active:scale-[0.97]
      transition shadow-sm cursor-pointer
    "
  >
    Mañana / Tarde
  </button>
</div>

{diaActivo?.turno === "MANANA" && (
  <div className="space-y-2">
    <div className="text-sm font-medium">Mañana</div>
    <div className="flex gap-2">
      <input
        type="time"
        value={horasManana.entrada}
        onChange={(e) =>
          setHorasManana({ ...horasManana, entrada: e.target.value })
        }
        className="border rounded-lg px-2 py-1 w-full"
      />
      <input
        type="time"
        value={horasManana.salida}
        onChange={(e) =>
          setHorasManana({ ...horasManana, salida: e.target.value })
        }
        className="border rounded-lg px-2 py-1 w-full"
      />
    </div>
  </div>
)}


{diaActivo?.turno === "TARDE" && (
  <div className="space-y-2">
    <div className="text-sm font-medium">Tarde</div>
    <div className="flex gap-2">
      <input
        type="time"
        value={horasTarde.entrada}
        onChange={(e) =>
          setHorasTarde({ ...horasTarde, entrada: e.target.value })
        }
        className="border rounded-lg px-2 py-1 w-full"
      />
      <input
        type="time"
        value={horasTarde.salida}
        onChange={(e) =>
          setHorasTarde({ ...horasTarde, salida: e.target.value })
        }
        className="border rounded-lg px-2 py-1 w-full"
      />
    </div>
  </div>
)}


{diaActivo?.turno === "MANANA_TARDE" && (
  <div className="space-y-4">
    {/* Mañana */}
    <div>
      <div className="text-sm font-medium">Mañana</div>
      <div className="flex gap-2">
        <input
          type="time"
          value={horasManana.entrada}
          onChange={(e) =>
            setHorasManana({ ...horasManana, entrada: e.target.value })
          }
          className="border rounded-lg px-2 py-1 w-full"
        />
        <input
          type="time"
          value={horasManana.salida}
          onChange={(e) =>
            setHorasManana({ ...horasManana, salida: e.target.value })
          }
          className="border rounded-lg px-2 py-1 w-full"
        />
      </div>
    </div>

    {/* Tarde */}
    <div>
      <div className="text-sm font-medium">Tarde</div>
      <div className="flex gap-2">
        <input
          type="time"
          value={horasTarde.entrada}
          onChange={(e) =>
            setHorasTarde({ ...horasTarde, entrada: e.target.value })
          }
          className="border rounded-lg px-2 py-1 w-full"
        />
        <input
          type="time"
          value={horasTarde.salida}
          onChange={(e) =>
            setHorasTarde({ ...horasTarde, salida: e.target.value })
          }
          className="border rounded-lg px-2 py-1 w-full"
        />
      </div>
    </div>
  </div>
)}

<button
  onClick={guardarHorario}
  className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-800 transition cursor-pointer"
>
  Guardar horario
</button>

<div className="text-xs uppercase tracking-wide text-slate-400">
  Estado del día
</div>


            <div className="grid grid-cols-2 gap-3 ">
              <Accion
                icon={<Plane />}
                label="Vacaciones"
                onClick={() => marcarDia("VACACIONES")}
              />
              <Accion
  icon={<Briefcase />}
  label="Día libre"
  onClick={() => marcarDia("DIA_LIBRE")}
/>
<Accion
  icon={<CalendarDays />}
  label="D. Festivo"
  onClick={() => marcarDia("FESTIVO")}
/>


              <Accion
                icon={<Ban />}
                label="Baja"
                onClick={() => marcarDia("BAJA")}
              />
              <Accion
                icon={<Trash2 />}
                label="Eliminar"
                danger
                onClick={eliminarMarca}
              />
            </div>
          </div>
        </div>
      )}

    {diaActivo && modoModal === "JORNADAS" && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-[440px] space-y-6 shadow-xl">

      {/* CABECERA */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Jornadas · {formatFechaES(diaActivo.fecha)}
        </h2>

        <button
          onClick={() => {
            setDiaActivo(null);
            setModoModal(null);
          }}
          className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* MAÑANA */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold text-sm text-slate-700">
          Jornada de mañana
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="time"
            value={jornadaManana.entrada}
            onChange={(e) =>
              setJornadaManana({ ...jornadaManana, entrada: e.target.value })
            }
            className="border rounded-lg px-3 py-2"
            placeholder="Entrada"
          />

          <input
            type="time"
            value={jornadaManana.salida}
            onChange={(e) =>
              setJornadaManana({ ...jornadaManana, salida: e.target.value })
            }
            className="border rounded-lg px-3 py-2"
            placeholder="Salida"
          />
        </div>
      </div>

      {/* TARDE */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold text-sm text-slate-700">
          Jornada de tarde
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="time"
            value={jornadaTarde.entrada}
            onChange={(e) =>
              setJornadaTarde({ ...jornadaTarde, entrada: e.target.value })
            }
            className="border rounded-lg px-3 py-2"
            placeholder="Entrada"
          />

          <input
            type="time"
            value={jornadaTarde.salida}
            onChange={(e) =>
              setJornadaTarde({ ...jornadaTarde, salida: e.target.value })
            }
            className="border rounded-lg px-3 py-2"
            placeholder="Salida"
          />
        </div>
      </div>

      {/* ACCIONES */}
      <div className="flex gap-3 pt-2">
        <button
  onClick={async () => {
  const nuevos: { tipo: "ENTRADA" | "SALIDA"; hora: string }[] = [];

  if (jornadaManana.entrada)
    nuevos.push({ tipo: "ENTRADA", hora: jornadaManana.entrada });
  if (jornadaManana.salida)
    nuevos.push({ tipo: "SALIDA", hora: jornadaManana.salida });

  if (jornadaTarde.entrada)
    nuevos.push({ tipo: "ENTRADA", hora: jornadaTarde.entrada });
  if (jornadaTarde.salida)
    nuevos.push({ tipo: "SALIDA", hora: jornadaTarde.salida });

  

  await api.post("/crm/fichajes", {
    empleadoId,
    fecha: diaActivo?.fecha,
    fichajes: nuevos,
  });

  cargarHorario();        // ✅ AÑADIR
  setModoModal(null);
  setDiaActivo(null);
}}

  className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm hover:bg-slate-800 cursor-pointer"
>
  Guardar fichajes
</button>


        <button
          onClick={() => {
            setDiaActivo(null);
            setModoModal(null);
          }}
          className="flex-1 border rounded-xl py-2 text-sm hover:bg-slate-50 cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
)}




      {loading && (
        <div className="text-sm text-slate-500">
          Cargando datos…
        </div>
      )}
    </div>
  );
}

/* =========================
   COMPONENTES
========================= */
function Resumen({
  titulo,
  valor,
  highlight = false,
}: {
  titulo: string;
  valor: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div
        className={`text-xl font-semibold ${
          highlight ? "text-red-600" : ""
        }`}
      >
        {valor}
      </div>
    </div>
  );
}

function Accion({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border rounded-xl px-4 py-3
  font-medium
  hover:bg-slate-50
  active:scale-[0.98]
  transition

        ${danger ? "text-red-600 border-red-400" : ""}
      `}
    >
      {icon}
      {label}
    </button>
  );
}
