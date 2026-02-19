import { useState } from "react";
import GridLayout from "react-grid-layout";
import type { Layout } from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import DashboardFilters from "../../components/dashboard/DashboardFilters";
import Polizas3AniosChart from "../../components/dashboard/Polizas3AniosChart";
import PrimaEfectoChart from "../../components/dashboard/PrimaEfectoChart";
import PrimaCreatedChart from "../../components/dashboard/PrimaCreatedChart";

const CARD =
  "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden";

export default function Dashboard() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser?.role === "admin";

  const [aseguradora, setAseguradora] = useState("ALL");
  const [ramo, setRamo] = useState("ALL");
  const [usuario, setUsuario] = useState("ALL");

 
 const [layout, setLayout] = useState<Layout[]>([
  { i: "polizas", x: 0, y: 0, w: 6, h: 9 },
  { i: "primaEfecto", x: 6, y: 0, w: 6, h: 9 },
  { i: "primaCreated", x: 0, y: 9, w: 12, h: 9 },
]);

const [manualChange, setManualChange] = useState(false);

/* =========================
   HACER VISOR PRINCIPAL
========================= */
const makeMain = (id: string) => {
  setManualChange(true);

  const others = layout.filter((l) => l.i !== id);

  const newLayout: Layout[] = [
    { i: id, x: 0, y: 0, w: 12, h: 10 },
    { i: others[0].i, x: 0, y: 10, w: 6, h: 7 },
    { i: others[1].i, x: 6, y: 10, w: 6, h: 7 },
  ];

  setLayout(newLayout);
};

/* =========================
   DRAG → DETECTAR EL MÁS ALTO
========================= */
const handleLayoutChange = (newLayout: Layout[]) => {

  if (manualChange) {
    setManualChange(false);
    return;
  }

  const sorted = [...newLayout].sort((a, b) => a.y - b.y);
  const topItem = sorted[0];

  if (!topItem) return;

  if (topItem.w !== 12) {
    makeMain(topItem.i);
  }
};


  const isMain = (id: string) => {
    const item = layout.find((l) => l.i === id);
    return item?.y === 0;
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">
              Dashboard CRM
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Panel analítico · Comparativa 3 años
            </p>
          </div>

          <div className="w-full lg:w-auto">
            <DashboardFilters
              isAdmin={isAdmin}
              aseguradora={aseguradora}
              setAseguradora={setAseguradora}
              ramo={ramo}
              setRamo={setRamo}
              usuario={usuario}
              setUsuario={setUsuario}
            />
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="px-6 pb-10">
        <GridLayout
  layout={layout}
  onLayoutChange={handleLayoutChange}
  cols={12}
  rowHeight={38}
  width={1400}
  margin={[24, 24]}
  containerPadding={[0, 0]}
  isResizable={false}
  draggableHandle=".drag-handle"
>


          {/* POLIZAS */}
<div key="polizas" className={CARD}>
  <div className="flex justify-between items-center px-6 py-3 border-b bg-slate-50">
    <span className="font-medium">Pólizas</span>

    {!isMain("polizas") && (
      <button
        onClick={() => makeMain("polizas")}
        className="text-xs bg-slate-200 px-3 py-1 rounded-lg hover:bg-slate-300 transition"
      >
        Principal
      </button>
    )}
  </div>

  <div
    className={`p-4 drag-handle ${
      isMain("polizas") ? "h-[420px]" : "h-[260px]"
    }`}
  >
    <Polizas3AniosChart
      aseguradora={aseguradora}
      ramo={ramo}
      usuario={usuario}
    />
  </div>
</div>


          {/* PRIMA EFECTO */}
          <div key="primaEfecto" className={CARD}>
            <div className="flex justify-between items-center px-6 py-3 border-b bg-slate-50">
              <span className="font-medium">Primas · Fecha efecto</span>
              {!isMain("primaEfecto") && (
                <button
                  onClick={() => makeMain("primaEfecto")}
                  className="text-xs bg-slate-200 px-3 py-1 rounded-lg hover:bg-slate-300 transition"
                >
                  Principal
                </button>
              )}
            </div>
            <div className={`p-4 ${isMain("primaEfecto") ? "h-[420px]" : "h-[260px]"}`}>
              <PrimaEfectoChart
                aseguradora={aseguradora}
                ramo={ramo}
                usuario={usuario}
              />
            </div>
          </div>

          {/* PRIMA CREATED */}
          <div key="primaCreated" className={CARD}>
            <div className="flex justify-between items-center px-6 py-3 border-b bg-slate-50">
              <span className="font-medium">Primas · Registro </span>
              {!isMain("primaCreated") && (
                <button
                  onClick={() => makeMain("primaCreated")}
                  className="text-xs bg-slate-200 px-3 py-1 rounded-lg hover:bg-slate-300 transition"
                >
                  Principal
                </button>
              )}
            </div>
            <div className={`p-4 ${isMain("primaCreated") ? "h-[420px]" : "h-[260px]"}`}>
              <PrimaCreatedChart
                aseguradora={aseguradora}
                ramo={ramo}
                usuario={usuario}
              />
            </div>
          </div>

        </GridLayout>
      </div>
    </div>
  );
}
