import { useEffect, useState } from "react";
import api from "../../services/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* =======================
   TIPOS
======================= */
type Fichaje = {
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
};

type Dia = {
  fecha: string;
  diaSemana: string;
  minutosTrabajados: number;
  fichajes: Fichaje[];
};


type HistorialResponse = {
  mes: string; // YYYY-MM
  totalHoras: string;
  diasTrabajados: number;
  horasContratadasSemana: number; // 👈 AÑADIR ESTA LÍNEA
  dias: Dia[];
};


/* =======================
   HELPERS (YA EXISTENTES)
======================= */
const formatearMes = (mes: string) => {
  const [year, month] = mes.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
};

const getWeekRange = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    key: monday.toISOString().slice(0, 10),
    label: `Semana del ${monday.toLocaleDateString(
      "es-ES"
    )} al ${sunday.toLocaleDateString("es-ES")}`,
  };
};

// const horasToMin = (horas?: string) => {
//   if (!horas) return 0;

//   const nums = horas.match(/\d+/g)?.map(Number) || [0, 0];
//   const h = nums[0] ?? 0;
//   const m = nums[1] ?? 0;

//   return h * 60 + m;
// };


const minToHoras = (min: number) =>
  `${Math.floor(min / 60)} h ${min % 60} min`;

/* =======================
   HELPERS NUEVOS (MES)
======================= */
const sumarMes = (mes: string, delta: number) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const esMesFuturo = (mes: string) => {
  const ahora = new Date();
  const [y, m] = mes.split("-").map(Number);
  const actual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const comparar = new Date(y, m - 1, 1);
  return comparar > actual;
};

/* =======================
   COMPONENTE
======================= */
export default function HistorialHorario() {
  const mesSistema = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}`;

  const [mesActual, setMesActual] = useState(mesSistema);
  const [data, setData] = useState<HistorialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const res = await api.get("/horario/historial", {
          params: { mes: mesActual },
        });
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [mesActual]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cargando historial…
      </div>
    );
  }

 if (!data) {
  return (
    <div className="p-6 text-slate-500">
      No hay datos disponibles
    </div>
  );
}
// console.log("HORAS CONTRATO:", data.horasContratadasSemana);
const minutosContratoSemana =
  Number(data.horasContratadasSemana ?? 0) * 60;

  const diasTrabajados = data.dias.filter(
  d => (d.minutosTrabajados ?? 0) > 0
).length;

const totalMinutosMes = data.dias.reduce(
  (acc, d) => acc + (d.minutosTrabajados ?? 0),
  0
);

const totalHorasMes = minToHoras(totalMinutosMes);



  /* =======================
     AGRUPAR POR SEMANAS
  ======================= */
  const semanas: Record<
    string,
    { label: string; dias: Dia[]; totalMin: number }
  > = {};

  data.dias.forEach((dia) => {
    const week = getWeekRange(dia.fecha);

    if (!semanas[week.key]) {
      semanas[week.key] = {
        label: week.label,
        dias: [],
        totalMin: 0,
      };
    }

    semanas[week.key].dias.push(dia);
    semanas[week.key].totalMin += dia.minutosTrabajados ?? 0;

  });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 space-y-6">
      {/* HEADER CON SELECTOR DE MES */}
      <div className="flex items-center justify-between">
        <button
  onClick={() => setMesActual(sumarMes(mesActual, -1))}
  className="
    p-2 rounded-lg bg-white shadow
    cursor-pointer
    hover:bg-slate-50
    transition
    active:scale-95
  "
>

          <ChevronLeft />
        </button>

        <div className="text-center space-y-1">
  <h1 className="text-xl font-semibold capitalize">
    Historial · {formatearMes(data.mes)}
  </h1>

  <div className="text-slate-600 text-sm leading-tight">
    <div>
      Días trabajados:{" "}
      <span className="font-medium">{diasTrabajados}</span>
    </div>

    <div>
      Horas trabajadas:{" "}
      <span className="font-medium">{totalHorasMes}</span>
    </div>
  </div>
</div>


        <button
  onClick={() => setMesActual(sumarMes(mesActual, 1))}
  disabled={esMesFuturo(sumarMes(mesActual, 1))}
  className={`
    p-2 rounded-lg shadow transition
    ${
      esMesFuturo(sumarMes(mesActual, 1))
        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
        : "bg-white cursor-pointer hover:bg-slate-50 active:scale-95"
    }
  `}
>

          <ChevronRight />
        </button>
      </div>

      {/* SEMANAS */}
      <div className="space-y-8">
       {Object.values(semanas)
  .filter((semana) => semana.totalMin > 0)
  .map((semana) => (

          <div key={semana.label} className="space-y-4">
            {/* SEPARADOR SEMANA */}
            <div className="bg-slate-100 rounded-lg px-4 py-2 text-sm text-slate-600">
  <div className="font-medium">{semana.label}</div>

  <div className="flex justify-between">
    <span>
      Horas trabajadas:{" "}
      <span className="font-semibold">
        {minToHoras(semana.totalMin)}
      </span>
    </span>

    {(() => {
      const diff =
  semana.totalMin - (Number(minutosContratoSemana) || 0);

      return (
        <span
          className={
            diff > 0
              ? "text-green-600 font-semibold"
              : diff < 0
              ? "text-red-600 font-semibold"
              : "text-slate-500"
          }
        >
          {diff > 0 ? "+" : diff < 0 ? "-" : ""}
          {minToHoras(Math.abs(diff))}
        </span>
      );
    })()}
  </div>
</div>


            {/* DÍAS */}
            {semana.dias
  .filter((dia) => (dia.minutosTrabajados ?? 0) > 0)
  .map((dia) => (

              <div
  key={dia.fecha}
  className={`
    rounded-xl shadow p-4 transition
    ${
      openDay === dia.fecha
  ? "bg-blue-50 border border-blue-200"
  : "bg-white border border-transparent"

    }
  `}
>

              <button
  onClick={() =>
    setOpenDay(openDay === dia.fecha ? null : dia.fecha)
  }
  className={`
    w-full flex justify-between items-center
    rounded-lg p-2 -m-2
    transition cursor-pointer
    ${
      openDay === dia.fecha
        ? "bg-blue-100"
        : "hover:bg-slate-50"
    }
  `}
>


                  <div className="text-left">
                    <div className="font-medium capitalize">
                      {dia.diaSemana}
                    </div>
                    <div className="text-sm text-slate-500">
                      {dia.fecha}
                    </div>
                  </div>

                <div className="font-semibold">
  {minToHoras(dia.minutosTrabajados ?? 0)}
</div>


                </button>

                {openDay === dia.fecha && (() => {
  const fichajesOrdenados = [...dia.fichajes].sort(
    (a, b) => a.hora.localeCompare(b.hora)
  );

  return (
    <div className="mt-4 border-t pt-3 space-y-2">
      {fichajesOrdenados.map((f, i) => (
        <div
          key={i}
          className="flex justify-between text-sm text-slate-600"
        >
          <span>{f.tipo}</span>
          <span>{f.hora}</span>
        </div>
      ))}
    </div>
  );
})()}

                
                
              </div>
            ))}
            
          </div>
        ))}
      </div>
    </div>
  );
}
