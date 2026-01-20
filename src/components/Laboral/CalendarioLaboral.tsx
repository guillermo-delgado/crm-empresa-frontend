import { useEffect, useState } from "react";
import { useRef } from "react";
import api from "../../services/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LogIn, LogOut, ArrowRight } from "lucide-react";

const empleadoId = localStorage.getItem("userId");



/* =====================
   TIPOS
===================== */
type Fichaje = {
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
};

type DiaTrabajado = {
  fecha: string; // YYYY-MM-DD
  horas: string;
  minutos?: number;
  fichajes: Fichaje[];

  // 🔑 ESTADO REAL (IGUAL QUE CRM)
  estado?: "VACACIONES" | "DIA_LIBRE" | "BAJA" | "FESTIVO" | null;

  // 🔄 TURNOS
  turno?: "MANANA" | "TARDE" | "MANANA_TARDE";
  horaEntradaManana?: string | null;
  horaSalidaManana?: string | null;
  horaEntradaTarde?: string | null;
  horaSalidaTarde?: string | null;
};





type DiaBackend = {
  fecha: string;

  estado?: "VACACIONES" | "DIA_LIBRE" | "BAJA" | "FESTIVO" | null;

  minutosTrabajados: number;
  fichajes: Fichaje[];

  // 👇 ESTO ES LO QUE FALTABA
  turno?: "MANANA" | "TARDE" | "MANANA_TARDE";
  horaEntradaManana?: string | null;
  horaSalidaManana?: string | null;
  horaEntradaTarde?: string | null;
  horaSalidaTarde?: string | null;
};


// type HistorialResponse = {
//   mes: string; // YYYY-MM
//   dias: DiaBackend[];
// };

/* =====================
   CONFIGURACIÓN FECHAS
===================== */
const HOY = new Date();
const YEAR = HOY.getFullYear();
const MES_ACTUAL = HOY.getMonth(); // 0-11

/* =====================
   HELPERS
===================== */



const formatFechaES = (fechaISO: string) => {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
};

const getMonthLabel = (year: number, month: number) =>
  new Date(year, month).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

const getDiasDelMes = (year: number, month: number) => {
  const total = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => i + 1);
};





const minutosToHoras = (min: number) =>
  `${Math.floor(min / 60)} h ${min % 60} min`;

const esFinDeSemana = (fecha: string) => {
  const d = new Date(fecha);
  const day = d.getDay(); // 0 = domingo, 6 = sábado
  return day === 0 || day === 6;
};

const agruparFichajes = (fichajes: Fichaje[]) => {
  const bloques: { entrada: string; salida?: string }[] = [];

  for (let i = 0; i < fichajes.length; i++) {
    if (fichajes[i].tipo === "ENTRADA") {
      bloques.push({
        entrada: fichajes[i].hora,
        salida:
          fichajes[i + 1]?.tipo === "SALIDA"
            ? fichajes[i + 1].hora
            : undefined,
      });
    }
  }

  return bloques;
};






/* =====================
   COMPONENTE
===================== */
export default function CalendarioLaboral() {
  const [month, setMonth] = useState<number>(MES_ACTUAL);
  const [diasTrabajados, setDiasTrabajados] = useState<
    Record<string, DiaTrabajado>
  >({});
  const [diaActivo, setDiaActivo] = useState<DiaTrabajado | null>(null);

   const detalleRef = useRef<HTMLDivElement | null>(null);

 useEffect(() => {
  const cargar = async () => {
    const mes = `${YEAR}-${String(month + 1).padStart(2, "0")}`;

    // 1️⃣ CALENDARIO GENERAL (VACACIONES / FESTIVOS / DÍAS LIBRES)
   const resGeneral = await api.get(
  "/horario/calendario-general",
  { params: { mes } }
);

    // 2️⃣ CALENDARIO DEL EMPLEADO
    const resEmpleado = await api.get("/horario/historial", {
      params: {
        mes,
        empleadoId,
      },
    });

    const map: Record<string, DiaTrabajado> = {};

    // ⬇️ PRIMERO: CALENDARIO GENERAL
    resGeneral.data.dias.forEach((d: any) => {
      map[d.fecha] = {
        fecha: d.fecha,
        horas: "",
        minutos: 0,
        fichajes: [],
        estado: d.estado ?? d.tipo ?? null,
      };
    });

    // ⬇️ DESPUÉS: DATOS DEL EMPLEADO (PISAN AL GENERAL)
    resEmpleado.data.dias.forEach((d: DiaBackend) => {
      map[d.fecha] = {
        fecha: d.fecha,

        horas:
          d.minutosTrabajados > 0
            ? `${Math.floor(d.minutosTrabajados / 60)}h ${d.minutosTrabajados % 60}m`
            : "",

        minutos: d.minutosTrabajados,
        fichajes: d.fichajes ?? [],

        // 👇 SI EL EMPLEADO NO TIENE ESTADO, SE MANTIENE EL GENERAL
        estado: d.estado ?? map[d.fecha]?.estado ?? null,

       turno: d.turno ?? undefined,
        horaEntradaManana: d.horaEntradaManana ?? null,
        horaSalidaManana: d.horaSalidaManana ?? null,
        horaEntradaTarde: d.horaEntradaTarde ?? null,
        horaSalidaTarde: d.horaSalidaTarde ?? null,
      };
    });

    setDiasTrabajados(map);

    console.log("MAP FINAL >>>", map);
  };

  cargar();
}, [month, empleadoId]);



  const diasMes = getDiasDelMes(YEAR, month);
  const hoyISO = new Date().toISOString().slice(0, 10);

  /* =====================
    CÁLCULO
===================== */
const diasTrabajadosMes = Object.values(diasTrabajados).filter(
  (d) => d.minutos !== undefined && d.minutos > 0
);



const totalMinutos = diasTrabajadosMes.reduce(
  (acc, d) => acc + (d.minutos ?? 0),
  0
);



  /* =====================
     CLASES POR TIPO
  ===================== */
const getDayClasses = (dia?: DiaTrabajado, fecha?: string) => {
  // 1️⃣ ESTADOS (PRIORIDAD ABSOLUTA)
  if (dia?.estado === "VACACIONES") {
    return "bg-sky-100 text-sky-800 border-sky-300";
  }

  if (dia?.estado === "BAJA") {
    return "bg-red-100 text-red-800 border-red-300";
  }

  if (dia?.estado === "FESTIVO") {
    return "bg-violet-100 text-violet-800 border-violet-300";
  }

  if (
    dia?.estado === "DIA_LIBRE" &&
    fecha &&
    !esFinDeSemana(fecha)
  ) {
    return "bg-orange-100 text-orange-800 border-orange-300";
  }

  // 2️⃣ FIN DE SEMANA
  if (fecha && esFinDeSemana(fecha)) {
    return "bg-slate-100 text-slate-400 border-slate-300";
  }

  // 3️⃣ DÍA TRABAJADO
  if (dia?.minutos && dia.minutos > 0) {
    return "bg-green-100 text-green-800 border-green-300";
  }

  // 4️⃣ NORMAL
  return "bg-white text-slate-500 border-slate-200";
};









// Día de la semana del día 1 del mes
// JS: 0 = domingo, 1 = lunes, ..., 6 = sábado
const firstDayOfMonth = new Date(YEAR, month, 1).getDay();

// Convertimos para que lunes = 0, martes = 1, ..., domingo = 6
const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <button
  onClick={() => setMonth((m) => Math.max(0, m - 1))}
  disabled={month === 0}
  className="
    p-2 bg-white rounded-lg shadow
    cursor-pointer
    hover:bg-slate-50
    disabled:cursor-not-allowed
    disabled:opacity-30
  "
>

          <ChevronLeft />
        </button>

        <h1 className="text-lg font-semibold capitalize">
          {getMonthLabel(YEAR, month)}
        </h1>

        <button
  onClick={() => setMonth((m) => Math.min(11, m + 1))}
  disabled={month === 11}
  className="
    p-2 bg-white rounded-lg shadow
    cursor-pointer
    hover:bg-slate-50
    disabled:cursor-not-allowed
    disabled:opacity-30
  "
>

          <ChevronRight />
        </button>
      </div>

      {/* LEYENDA */}
<div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600">
  <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full bg-green-500" />
    <span>Día trabajado</span>
  </div>

  <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full bg-violet-500" />
    <span>Festivo</span>
  </div>

  <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full bg-sky-400" />
    <span>Vacaciones</span>
  </div>

  <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full bg-red-500" />
    <span>Baja</span>
  </div>

  <div className="flex items-center gap-2">
  <span className="w-3 h-3 rounded-full bg-orange-400" />
  <span>Día Libre</span>
</div>

</div>


{/* RESUMEN MENSUAL */}
{/* RESUMEN MENSUAL */}
<div className="flex justify-center">
  <div className="grid grid-cols-2 gap-6 max-w-md w-full">
    <div className="bg-white rounded-xl shadow p-5 text-center">
      <div className="text-sm text-slate-500">Días trabajados</div>
      <div className="text-2xl font-semibold mt-1">
        {diasTrabajadosMes.length}
      </div>
    </div>

    <div className="bg-white rounded-xl shadow p-5 text-center">
      <div className="text-sm text-slate-500">Horas trabajadas</div>
      <div className="text-2xl font-semibold mt-1">
        {minutosToHoras(totalMinutos)}
      </div>
    </div>
  </div>
</div>



      {/* CALENDARIO */}
      <div className="flex justify-center">
  <div className="w-full max-w-5xl overflow-x-auto sm:overflow-visible scroll-smooth">
    <div
      className="
        grid
        grid-cols-7
        gap-3
        text-center
        text-sm
        min-w-[700px]
        sm:min-w-0
      "
    >

  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
    <div key={d} className="font-medium text-slate-500">
      {d}
    </div>
  ))}

  {/* HUECOS INICIALES */}
  {Array.from({ length: offset }).map((_, i) => (
    <div key={`empty-${i}`} />
  ))}

  {/* DÍAS DEL MES */}
  {diasMes.map((dia) => {
    const fecha = `${YEAR}-${String(month + 1).padStart(2, "0")}-${String(
      dia
    ).padStart(2, "0")}`;

    const trabajado = diasTrabajados[fecha];
const isHoy = fecha === hoyISO;

const tipoFinal = trabajado;






    return (
      <button
  key={fecha}
  onClick={() => {
 if (!tipoFinal) return;


  setDiaActivo(tipoFinal);

  requestAnimationFrame(() => {
    detalleRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}}


 
  className={`
 touch-manipulation
  h-20 sm:h-20 md:h-24
  px-2
  rounded-xl border
 flex flex-col items-center justify-between
  gap-1.5
  transition
  shadow-sm hover:shadow-md
    ${
      tipoFinal
        ? getDayClasses(tipoFinal, fecha)
        : "bg-white text-slate-400 border-slate-200"
    }
    ${isHoy ? "ring-2 ring-blue-500" : ""}
    ${tipoFinal ? "hover:scale-[1.02] cursor-pointer" : "cursor-default"}

  `}
>
{/* ───────── TOP ───────── */}
<div className="flex flex-col items-center gap-0.5">
  {/* DÍA */}
  <div className="text-sm font-bold leading-none">
    {dia}
  </div>

  {/* ESTADO */}
  {tipoFinal?.estado && (
    <span
      className="
        text-[10px]
        font-semibold
        uppercase
        px-2
        py-0.5
        rounded-full
        bg-white/70
        backdrop-blur
        whitespace-nowrap
      "
    >
      {tipoFinal.estado === "FESTIVO" && "Festivo"}
      {tipoFinal.estado === "DIA_LIBRE" && "Libre"}
      {tipoFinal.estado === "VACACIONES" && "Vacaciones"}
      {tipoFinal.estado === "BAJA" && "Baja"}
    </span>
  )}
</div>

{/* ───────── CENTER ───────── */}
<div className="flex flex-col items-center text-center gap-0.5 w-full px-1">
  {/* TURNO (UNA LÍNEA + …) */}
  {tipoFinal?.turno && (
    <div
      className="
        text-[11px]
        font-medium
        text-slate-700
        whitespace-nowrap
        overflow-hidden
        text-ellipsis
        max-w-full
      "
    >
      {tipoFinal.turno === "MANANA" && "Mañana"}
      {tipoFinal.turno === "TARDE" && "Tarde"}
      {tipoFinal.turno === "MANANA_TARDE" && "Mañana / Tarde"}
    </div>
  )}

  {/* HORARIOS */}
  {tipoFinal?.turno === "MANANA" &&
    tipoFinal.horaEntradaManana &&
    tipoFinal.horaSalidaManana && (
      <div className="text-[11px] text-slate-600 leading-tight">
        {tipoFinal.horaEntradaManana} - {tipoFinal.horaSalidaManana}
      </div>
  )}

  {tipoFinal?.turno === "TARDE" &&
    tipoFinal.horaEntradaTarde &&
    tipoFinal.horaSalidaTarde && (
      <div className="text-[11px] text-slate-600 leading-tight">
        {tipoFinal.horaEntradaTarde} - {tipoFinal.horaSalidaTarde}
      </div>
  )}

  {tipoFinal?.turno === "MANANA_TARDE" && (
    <div className="text-[11px] text-slate-600 leading-tight">
      {tipoFinal.horaEntradaManana} - {tipoFinal.horaSalidaManana}
      <br />
      {tipoFinal.horaEntradaTarde} - {tipoFinal.horaSalidaTarde}
    </div>
  )}

  {/* HORAS TRABAJADAS (⬆️ SUBIDAS DENTRO DEL CUADRO) */}
  {tipoFinal?.horas && tipoFinal.estado !== "DIA_LIBRE" && (
    <div className="text-[10px] font-semibold text-slate-700 mt-0.5">
      {tipoFinal.horas}
    </div>
  )}
</div>





</button>


    );
  })}
</div>
</div>
</div>

      {/* DETALLE DÍA */}
      {diaActivo && (
  <div
    ref={detalleRef}
    className="bg-white rounded-xl shadow p-4 space-y-2"
  >
          <div className="flex items-center justify-between">
  <div className="text-base font-semibold text-slate-800">
    {formatFechaES(diaActivo.fecha)}
  </div>

  <div className="text-sm font-medium text-slate-500">
    {diaActivo.horas}
  </div>
</div>


<div className="mt-6 space-y-3">
  {agruparFichajes(diaActivo.fichajes).map((b, i) => {
    const duracion =
      b.salida
        ? (() => {
            const [h1, m1] = b.entrada.split(":").map(Number);
            const [h2, m2] = b.salida.split(":").map(Number);
            return h2 * 60 + m2 - (h1 * 60 + m1);
          })()
        : null;

    return (
      <div
        key={i}
        className="
          bg-white
          rounded-xl
          border border-slate-200
          px-5 py-4
          flex items-center justify-between
        "
      >
        {/* IZQUIERDA */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-lg font-semibold text-slate-800">
            <span>{b.entrada}</span>
            <ArrowRight size={18} className="text-slate-400" />
            <span>{b.salida ?? "—"}</span>
          </div>

          <div className="flex gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <LogIn size={14} />
              Entrada
            </div>
            <div className="flex items-center gap-1">
              <LogOut size={14} />
              Salida
            </div>
          </div>
        </div>

        {/* DERECHA */}
        {duracion !== null && (
          <div className="text-sm font-medium text-slate-600">
            {duracion} min
          </div>
        )}
      </div>
    );
  })}
</div>





          <button
  onClick={() => setDiaActivo(null)}
  className="text-sm text-blue-600 mt-2 cursor-pointer hover:underline"
>
  Cerrar
</button>

        </div>
      )}
    </div>
  );
}
