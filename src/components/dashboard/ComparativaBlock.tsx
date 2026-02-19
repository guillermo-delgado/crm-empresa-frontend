import { useEffect, useState } from "react";
import api from "../../services/api";
import Polizas3AniosChart from "./Polizas3AniosChart";
import PrimaEfectoChart from "./PrimaEfectoChart";
import PrimaCreatedChart from "./PrimaCreatedChart";

export type DashboardMode =
  | "polizas"
  | "primaEfecto"
  | "primaCreated";

const CARD =
  "bg-white border border-slate-200 rounded-xl shadow-sm";

type BackendResponse = Record<string, number[]>;

type Props = {
  mode: DashboardMode;
  setMode: (m: DashboardMode) => void;
  aseguradora: string;
  ramo: string;
  usuario: string;
};

export default function ComparativaBlock({
  mode,
  setMode,
  aseguradora,
  ramo,
  usuario,
}: Props) {

  const [data, setData] = useState<BackendResponse>({});
  const [loading, setLoading] = useState(true);

  /* =========================
     FETCH DATA
  ========================= */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const res = await api.get(
          "/ventas/dashboard/polizas-3-anios",
          {
            params: {
              aseguradora,
              ramo,
              usuario,
              tipo: mode,
            },
          }
        );

        setData(res.data || {});
      } catch (error) {
        console.error("Error ComparativaBlock:", error);
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [aseguradora, ramo, usuario, mode]);

  /* =========================
     TITULO DINÁMICO
  ========================= */
  const titulo =
    mode === "polizas"
      ? "Número de pólizas"
      : mode === "primaEfecto"
      ? "Prima por fecha efecto"
      : "Prima por registro (createdAt)";

  /* =========================
     NAVEGACIÓN MÉTRICA
  ========================= */
  const goLeft = () => {
    if (mode === "primaCreated") setMode("primaEfecto");
    else if (mode === "primaEfecto") setMode("polizas");
  };

  const goRight = () => {
    if (mode === "polizas") setMode("primaEfecto");
    else if (mode === "primaEfecto") setMode("primaCreated");
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className={`${CARD} p-6`}>

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">

        <button
          onClick={goLeft}
          disabled={mode === "polizas"}
          className="px-4 py-2 border rounded-lg hover:bg-slate-100 disabled:opacity-40"
        >
          ←
        </button>

        <p className="text-sm font-semibold text-slate-600 text-center">
          {titulo}
        </p>

        <button
          onClick={goRight}
          disabled={mode === "primaCreated"}
          className="px-4 py-2 border rounded-lg hover:bg-slate-100 disabled:opacity-40"
        >
          →
        </button>

      </div>

      {/* CONTENIDO */}
      {loading ? (
        <div className="h-96 flex items-center justify-center text-slate-400 text-sm">
          Cargando gráfica...
        </div>
      ) : (
        <div className="h-[420px]">
          {mode === "polizas" && (
            <Polizas3AniosChart
              aseguradora={aseguradora}
              ramo={ramo}
              usuario={usuario}
            />
          )}

          {mode === "primaEfecto" && (
            <PrimaEfectoChart
              aseguradora={aseguradora}
              ramo={ramo}
              usuario={usuario}
            />
          )}

          {mode === "primaCreated" && (
            <PrimaCreatedChart
              aseguradora={aseguradora}
              ramo={ramo}
              usuario={usuario}
            />
          )}
        </div>
      )}

      {/* 👇 Uso técnico para evitar warning de variable no utilizada */}
      <div className="hidden">
        {Object.keys(data).length}
      </div>

    </div>
  );
}
