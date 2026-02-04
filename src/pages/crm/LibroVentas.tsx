import { useEffect, useMemo, useState } from "react";
import KPICard from "../../components/crm/KPICard";
import VentasTable from "../../components/crm/VentasTable";
import InfoModal from "../../components/common/InfoModal";
import EditVentaModal from "../../components/ventas/EditVentaModal";
import ConfirmModal from "../../components/common/ConfirmModal";
import VentasGlobalSearch from "../../components/crm/VentasGlobalSearch";
import VentasTableSkeleton from "../../components/crm/skeletons/VentasTableSkeleton";
import KPICardSkeleton from "../../components/crm/skeletons/KPICardSkeleton";
import ProduccionRamoSkeleton from "../../components/crm/skeletons/ProduccionRamoSkeleton";
import VentasSearchSkeleton from "../../components/crm/skeletons/VentasSearchSkeleton";
import PeriodoSelectorSkeleton from "../../components/crm/skeletons/PeriodoSelectorSkeleton";
import { registerVentasSocketHandlers } from "../../services/ventasSocketHandlers";
import api from "../../services/api";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSocket } from "../../services/socket";
import AnularVentaModal from "../../components/ventas/AnularVentaModal";
import RehabilitarVentaModal from "../../components/ventas/RehabilitarVentaModal";




type VentaAPI = {
  _id: string;
  fechaEfecto: string;
  numeroPoliza: string;
  tomador: string;
  aseguradora: string;
  ramo: string;
  primaNeta: number;
  formaPago?: string;

  createdBy?: {
    nombre: string;
  };

  estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;

  anulada?: boolean;
};




type VentaEditando = {
  data: VentaAPI;
  original: VentaAPI;
  changedFields: string[];
  solicitudId?: string;
  fromSocket?: boolean;
};

type VentaAEliminar = VentaAPI & {
  solicitudId?: string;
};


type LayoutContext = {
  setRevisionCount: React.Dispatch<React.SetStateAction<number>>;
};
const CARD = "bg-white border border-slate-200 rounded-[12px] ";

export default function LibroVentas() {
  const { setRevisionCount } = useOutletContext<LayoutContext>();
// console.log("OK setRevisionCount:", setRevisionCount);

  const navigate = useNavigate();

   /* =========================
     USUARIO ACTUAL
  ========================= */
  let currentUser: any = null;
try {
  currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch {
  currentUser = null;
}

  const isAdmin = currentUser?.role === "admin";

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

// BUSCADOR
  const [search, setSearch] = useState("");
  const searchActive = search.trim().length >= 2;

const [ventasBusqueda, setVentasBusqueda] = useState<VentaAPI[] | null>(null);
const [loadingBusqueda, setLoadingBusqueda] = useState(false);
loadingBusqueda;





  // 📅 Límites de periodo (empleados)
const hoy = new Date();
const minPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
const maxPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 1);


const [showSolicitudesModal, setShowSolicitudesModal] = useState(false);
const [solicitudes, setSolicitudes] = useState<any[]>([]);
const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<any | null>(null);
const [ventaARehabilitar, setVentaARehabilitar] = useState<any | null>(null);


const [showDeleteInfo, setShowDeleteInfo] = useState(false);
const solicitudesOrdenadas = useMemo(() => {
  return [...solicitudes].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime()
  );
}, [solicitudes]);




useEffect(() => {
  if (search.trim().length < 2) {
    setVentasBusqueda(null);
    return;
  }

  const timeout = setTimeout(async () => {
    try {
      setLoadingBusqueda(true);
      const res = await api.get(
        `/ventas/buscar?q=${encodeURIComponent(search)}`
      );
      setVentasBusqueda(res.data || []);
    } catch {
      setVentasBusqueda([]);
    } finally {
      setLoadingBusqueda(false);
    }
  }, 300);

  return () => clearTimeout(timeout);
}, [search]);





  const [ventas, setVentas] = useState<VentaAPI[]>([]);
  // 🔔 BADGE EMPLEADO – EXACTAMENTE COMO EL CÓDIGO ANTIGUO
// useEffect(() => {
//   if (isAdmin) return;

//   const notificar = ventas.filter(
//     v =>
//       v.estadoRevision === "aceptada" ||
//       v.estadoRevision === "rechazada"
//   ).length;

//   setRevisionCount(notificar);
// }, [ventas, isAdmin]);


  // useEffect(() => {
  // if (isAdmin) return;

//   const pendientes = ventas.filter(
//     v => v.estadoRevision === "pendiente" || v.estadoRevision === "aceptada" || v.estadoRevision === "rechazada"
//   ).length;

//   setRevisionCount(pendientes);
// }, [ventas, isAdmin]);

  const [loading, setLoading] = useState(false);

  const [ventaEditando, setVentaEditando] = useState<VentaEditando | null>(null);
const [ventaAEliminar, setVentaAEliminar] = useState<VentaAEliminar | null>(null);
const [ventaAAnular, setVentaAAnular] = useState<VentaAPI | null>(null);

  

  const [aseguradora, setAseguradora] = useState("ALL");
  const [usuario, setUsuario] = useState("ALL");
  const [ramo, setRamo] = useState("ALL");
  

  /* =========================
     SOLICITUDES PENDIENTES
  ========================= */

const cargarSolicitudes = async () => {
  try {
    const res = await api.get("/solicitudes");
    setSolicitudes(res.data || []);
    // ❌ NUNCA setRevisionCount AQUÍ
  } catch {
    // nada
  }
};










  const fetchLibroVentas = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ventas/libro?month=${mes}&year=${anio}`);
      setVentas(Array.isArray(res.data.ventas) ? res.data.ventas : []);
    } catch (e) {
      console.error("Error cargando libro de ventas", e);
    } finally {
      setLoading(false);
    }
  };

// 1️⃣ Cargar ventas al cambiar periodo
useEffect(() => {
  fetchLibroVentas();
}, [mes, anio]);

// 2️⃣ Cargar solicitudes pendientes al entrar (ADMIN)
useEffect(() => {
  if (!isAdmin) return;
  cargarSolicitudes();
}, [isAdmin]);

// 🔔 Cargar revisiones pendientes al entrar (EMPLEADO)
// useEffect(() => {
//   if (isAdmin) return;

//   const cargarRevisionesEmpleado = async () => {
//     try {
//       const res = await api.get("/ventas/revisiones-pendientes");
//       setRevisionCount(res.data?.count ?? 0);
//     } catch {
//       setRevisionCount(0);
//     }
//   };

//   cargarRevisionesEmpleado();
// }, [isAdmin]);

// 3️⃣ Socket tiempo real
useEffect(() => {
  const socket = getSocket();
  if (!socket) return;

  const cleanup = registerVentasSocketHandlers({
    socket,
    isAdmin,
    setVentas,
    setRevisionCount,
    cargarSolicitudes,
  });

  return cleanup;
}, [isAdmin]);





useEffect(() => {
 // console.log("🔵 useEffect solicitudSeleccionada:", solicitudSeleccionada);
  if (!solicitudSeleccionada) return;

  const s = solicitudSeleccionada;

  // 🟢 REHABILITAR LOCAL (desde tabla, no backend)
if (s.tipo === "REHABILITAR_VENTA" && s.local) {
  // Garantiza que el modal tenga venta
  if (!ventaARehabilitar && s.venta?._id) {
    api.get(`/ventas/${s.venta._id}`).then(res => {
      setVentaARehabilitar(res.data);
    });
  }

  setShowSolicitudesModal(false);
  return;
}


  const resolverSolicitud = async () => {
    try {
      // 🟢 EDITAR
      if (s.tipo === "EDITAR_VENTA") {
        const res = await api.get(`/ventas/${s.venta._id}`);
        const original = res.data;

        setVentaEditando({
          data: { ...original, ...s.payload },
          original,
          changedFields: Object.keys(s.payload || {}),
          solicitudId: s._id,
          fromSocket: true,
        });
      }

      // 🔴 ELIMINAR
      if (s.tipo === "ELIMINAR_VENTA") {
        const res = await api.get(`/ventas/${s.venta._id}`);
        const original = res.data;

        setVentaEditando({
          data: original,
          original,
          changedFields: ["__DELETE__"],
          solicitudId: s._id,
          fromSocket: true,
        });
      }

      // 🔴 ANULAR
      if (s.tipo === "ANULAR_VENTA") {
        const res = await api.get(`/ventas/${s.venta._id}`);

        setVentaAAnular({
          ...res.data,
          solicitudId: s._id,
          payload: s.payload,
          solicitadoPor: s.solicitadoPor,
        });
      }

      // 🟢 REHABILITAR (SOLICITUD REAL desde backend)
      if (s.tipo === "REHABILITAR_VENTA" && !s.local) {
        const res = await api.get(`/ventas/${s.venta._id}`);

        setVentaARehabilitar({
          ...res.data,
          solicitadoPor: s.solicitadoPor,
        });
      }

      setShowSolicitudesModal(false);
    } catch {
      alert("Error abriendo la solicitud");
    }
  };

  resolverSolicitud();
}, [solicitudSeleccionada]);


/* =========================
   🔖 LABELS SOLICITUDES
========================= */
const SOLICITUD_LABELS: Record<string, string> = {
  EDITAR_VENTA: "Editar venta",
  ANULAR_VENTA: "Anular venta",
  REHABILITAR_VENTA: "Rehabilitar venta",
  ELIMINAR_VENTA: "Eliminar venta",
};

const SOLICITUD_COLORS: Record<string, string> = {
  EDITAR_VENTA: "text-blue-600",
  ANULAR_VENTA: "text-orange-600",
  REHABILITAR_VENTA: "text-green-600",
  ELIMINAR_VENTA: "text-red-600",
};



const ventasBase = useMemo(() => {
  if (ventasBusqueda !== null) {
    return ventasBusqueda;
  }
  return ventas;
}, [ventasBusqueda, ventas]);




  /* =========================
     FILTROS
  ========================= */
const ventasFiltradas = useMemo(() => {
  return ventasBase.filter((v) => {
    if (aseguradora !== "ALL" && v.aseguradora !== aseguradora) return false;
    if (usuario !== "ALL" && v.createdBy?.nombre !== usuario) return false;
    if (ramo !== "ALL" && v.ramo !== ramo) return false;
    return true;
  });
}, [ventasBase, aseguradora, usuario, ramo]);



  /* =========================
     KPIs
  ========================= */
  const produccionTotal = ventasFiltradas.reduce(
    (acc, v) => acc + v.primaNeta,
    0
  );

  const produccionPorRamo = useMemo(() => {
    return ventasFiltradas.reduce<Record<string, number>>((acc, v) => {
      acc[v.ramo] = (acc[v.ramo] || 0) + v.primaNeta;
      return acc;
    }, {});
  }, [ventasFiltradas]);

  const aseguradoras = Array.from(new Set(ventas.map(v => v.aseguradora)));
  const usuarios = Array.from(new Set(ventas.map(v => v.createdBy?.nombre).filter(Boolean)));
  const ramos = Array.from(new Set(ventas.map(v => v.ramo)));
  /* =========================
     EXPORT EXCEL
  ========================= */
  const exportExcel = () => {
    const resumenData: any[][] = [];

    resumenData.push(["CRM · Libro de ventas"]);
    resumenData.push(["Control mensual de producción"]);
    resumenData.push([]);
    resumenData.push(["Periodo", `${mesNombre(mes)} ${anio}`]);
    resumenData.push([
      "Producción total",
      `${produccionTotal.toFixed(2)} €`,
    ]);
    resumenData.push([]);
    resumenData.push(["Producción por ramo"]);
    resumenData.push(["Ramo", "Producción (€)"]);

    Object.entries(produccionPorRamo).forEach(([ramo, total]) => {
      resumenData.push([ramo, total.toFixed(2)]);
    });

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 30 }, { wch: 25 }];

    const ventasData = ventasFiltradas.map(v => ({
      Fecha: new Date(v.fechaEfecto).toLocaleDateString(),
      Póliza: v.numeroPoliza,
      Tomador: v.tomador,
      Aseguradora: v.aseguradora,
      Ramo: v.ramo,
      "Prima (€)": v.primaNeta.toFixed(2),
      Usuario: v.createdBy?.nombre || "",
    }));

    const wsVentas = XLSX.utils.json_to_sheet(ventasData);
    wsVentas["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 25 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

    XLSX.writeFile(wb, `libro-ventas-${mesNombre(mes)}-${anio}.xlsx`);
  };

  /* =========================
     EXPORT PDF
  ========================= */
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text("CRM · Libro de ventas", 14, y);

    y += 6;
    doc.setFontSize(10);
    doc.text("Control mensual de producción", 14, y);

    y += 10;

    doc.setFontSize(11);
    // doc.text(`${produccionTotal.toFixed(2)} €`, 18, y + 13);

    autoTable(doc, {
      startY: y + 20,
      head: [["Fecha", "Póliza", "Tomador", "Aseguradora", "Ramo", "Prima", "Usuario"]],
      body: ventasFiltradas.map(v => [
        new Date(v.fechaEfecto).toLocaleDateString(),
        v.numeroPoliza,
        v.tomador,
        v.aseguradora,
        v.ramo,
        `${v.primaNeta.toFixed(2)} €`,
        v.createdBy?.nombre || "",
      ]),
    });

    doc.save(`libro-ventas-${mesNombre(mes)}-${anio}.pdf`);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      <div>
        <h1 className="text-2xl font-semibold">CRM · Libro de ventas</h1>
        <p className="text-sm text-slate-500">Control mensual de producción</p>
      </div>

       

      {/* AVISO ADMIN */}
     {isAdmin && solicitudes.length > 0 && (
  <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded">
    ⚠️ Tienes solicitudes de empleados pendientes de revisión
  </div>
)}


      {/* KPIs */}
     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {loading ? (
    <>
      <KPICardSkeleton />
      <PeriodoSelectorSkeleton />
      <ProduccionRamoSkeleton />
    </>
  ) : (
    <>
      <KPICard
        title="Producción total"
        value={`${produccionTotal.toFixed(2)} €`}
      />

      <PeriodoSelector
        mes={mes}
        anio={anio}
        setMes={setMes}
        setAnio={setAnio}
        minPeriodo={minPeriodo}
        maxPeriodo={maxPeriodo}
      />

      <div className={`${CARD} p-6`}>
        <h4 className="text-xs font-semibold text-slate-500 mb-2">
          Producción por ramo
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(produccionPorRamo).map(([r, total]) => (
            <div
              key={r}
              className="border border-slate-200 rounded-md px-3 py-2"
            >
              <p className="text-xs text-slate-500 truncate">{r}</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {total.toFixed(2)} €
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )}
</div>



{/* 🔍 BUSCADOR + FILTROS (ADMIN) */}
{loading ? (
  <VentasSearchSkeleton />
) : (
  <div className={`${CARD} p-6 space-y-4`}>

    {/* 🔍 BÚSQUEDA GLOBAL (TODOS) */}
    <VentasGlobalSearch
      value={search}
      onChange={setSearch}
    />

    {searchActive && (
      <p className="text-xs text-slate-500">
        🔍 Búsqueda activa · Se ignoran mes, año y filtros
      </p>
    )}

    {/* 🎛 FILTROS (SOLO ADMIN) */}
    {isAdmin && (
      <div
        className={`flex gap-6 flex-wrap items-end transition-opacity duration-200 ${
          searchActive ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <FiltroMes
          mes={mes}
          anio={anio}
          setMes={setMes}
          setAnio={setAnio}
          minPeriodo={minPeriodo}
          maxPeriodo={maxPeriodo}
        />

        <FiltroAnio
          anio={anio}
          setAnio={setAnio}
        />

        <Select
          label="Aseguradora"
          value={aseguradora}
          setValue={setAseguradora}
          options={aseguradoras}
        />

        <Select
          label="Ramo"
          value={ramo}
          setValue={setRamo}
          options={ramos}
        />

        <Select
          label="Usuario"
          value={usuario}
          setValue={setUsuario}
          options={usuarios}
        />
      </div>
    )}

  </div>
)}







     {/* TABLA */}
{loading ? (
  <div className="w-full overflow-x-auto">
    <div className="min-w-[1100px]">
      <VentasTableSkeleton rows={6} />
    </div>
  </div>
) : (
  <div className="w-full overflow-x-auto">
    <div className="min-w-[1100px] transition-opacity duration-200 ease-out">
      <VentasTable
       ventas={ventasFiltradas.map(v => ({
  _id: v._id,
  fecha: new Date(v.fechaEfecto).toLocaleDateString(),
  poliza: v.numeroPoliza,
  tomador: v.tomador,
  aseguradora: v.aseguradora,
  ramo: v.ramo,
  prima: v.primaNeta,
  usuario: v.createdBy?.nombre || "-",

  estadoRevision: (v as any).estadoRevision ?? null,
  estado: (v as any).estado,
  anulada: (v as any).estado === "ANULADA",
}))}

isAdmin={isAdmin}

onAnular={(row) => {
  const original = ventas.find(v => v._id === row._id);
  if (original) setVentaAAnular(original);
}}

onRehabilitar={(row) => {
  const original = ventas.find(v => v._id === row._id);
  if (!original) return;

  setVentaARehabilitar(original);

  setSolicitudSeleccionada({
  _id: original._id,          // se mantiene
  tipo: "REHABILITAR_VENTA",
  estado: "PENDIENTE",
  venta: { _id: original._id },
  local: true,                // 🔑 CLAVE
});


}}

onDelete={(row) => {
  const original = ventas.find(v => v._id === row._id);
  if (original) setVentaAEliminar(original);
}}

onClearRevision={async (row) => {
  await api.patch(`/ventas/${row._id}/marcar-revision-leida`);
  setVentas(prev =>
    prev.map(v =>
      v._id === row._id
        ? { ...v, estadoRevision: null }
        : v
    )
  );
  setRevisionCount(prev => Math.max(prev - 1, 0));
}}

onEdit={async (row) => {
  const originalVenta = ventas.find(v => v._id === row._id);
  if (!originalVenta) return;

  // ✅ COPIA PROFUNDA — el original NO se toca
  const original = JSON.parse(JSON.stringify(originalVenta));

  let ventaInicial: any = JSON.parse(JSON.stringify(original));
  let changedFields: string[] = [];
  let solicitudId: string | undefined;

  // 🟡 SI HAY REVISIÓN PENDIENTE → cargar solicitud
  if (original.estadoRevision === "pendiente") {
    try {
      const res = await api.get(
        `/ventas/${original._id}/solicitud-pendiente`
      );

      const solicitud = res.data;

      if (solicitud?.payload && typeof solicitud.payload === "object") {
        ventaInicial = {
          ...ventaInicial,
          ...solicitud.payload,
        };

        changedFields = Object.keys(solicitud.payload);
        solicitudId = solicitud._id; // 🔑 CLAVE
      }
    } catch {
      // fallback → edición normal
    }
  }

  // 🗓 Normalizar fecha para el formulario
  if (ventaInicial.fechaEfecto) {
    ventaInicial.fechaEfecto = String(
      ventaInicial.fechaEfecto
    ).slice(0, 10);
  }

  // 🔥 ABRIR MODAL
  setVentaEditando({
    data: ventaInicial,
    original,
    changedFields,
    solicitudId,
    fromSocket: false,
  });
}}

      />
    </div>
  </div>
)}



      
      {/* ACCIONES */}
<div className="flex flex-wrap gap-3">
  <button
    onClick={() => navigate("/crm/nueva-venta")}
    className="bg-slate-800 text-white px-4 py-2 rounded text-sm cursor-pointer"
  >
    + Nueva venta
  </button>

  {currentUser?.role === "admin" && (
    <>
      <button
        onClick={exportExcel}
        className="border px-4 py-2 rounded text-sm cursor-pointer"
      >
        Exportar Excel
      </button>

      <button
        onClick={exportPDF}
        className="border px-4 py-2 rounded text-sm cursor-pointer"
      >
        Exportar PDF
      </button>

      {/* 👇 BOTÓN PROVISIONAL */}
    {isAdmin && (
  <button
  onClick={async () => {
    try {
      const res = await api.get("/solicitudes");
      setSolicitudes(res.data || []);
      
      setShowSolicitudesModal(true);
    } catch {
      alert("Error cargando solicitudes");
    }
  }}
  className="relative border px-4 py-2 rounded text-sm cursor-pointer"
>
  Ver solicitudes pendientes

  {solicitudes.length > 0 && (
  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
    {solicitudes.length}
  </span>
)}

</button>

  
)}
{showSolicitudesModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

      {/* HEADER */}
      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-semibold">
          Solicitudes pendientes
        </h2>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {solicitudesOrdenadas.map((s) => (


     <div
  key={s._id}
  className="p-3 rounded border hover:bg-slate-100 cursor-pointer"
  onClick={() => {
  console.log("🟡 CLICK SOLICITUD:", s);
  setShowSolicitudesModal(false);   // 👈 CIERRA PRIMERO
  setSolicitudSeleccionada(s);      // 👈 LUEGO RESUELVE
}}

>


            <div className="text-sm font-medium">
              {s.venta?.tomador || "Sin tomador"}
            </div>
            <div
  className={`text-xs font-medium ${
    SOLICITUD_COLORS[s.tipo] || "text-slate-500"
  }`}
>
  {SOLICITUD_LABELS[s.tipo] || "Solicitud"}
</div>

          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 border-t flex justify-end">
        <button
          onClick={() => setShowSolicitudesModal(false)}
          className="px-5 py-2 rounded bg-slate-800 text-white hover:bg-slate-900"
        >
          Cerrar
        </button>
      </div>

    </div>
  </div>
)}




    </>
  )}
</div>


      {/* MODALES */}
      {ventaEditando && (
      <EditVentaModal
  venta={ventaEditando}
  onClose={() => setVentaEditando(null)}
 onSaved={(patch?: {
  _id: string;
  estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;
}) => {
  if (patch?._id) {
    setVentas(prev =>
      prev.map(v =>
        v._id === patch._id
          ? {
              ...v,
              estadoRevision:
                patch.estadoRevision !== undefined
                  ? patch.estadoRevision
                  : v.estadoRevision,
            }
          : v
      )
    );
  }

  setVentaEditando(null);
}}

/>


      )}

      {ventaAEliminar && (
  <ConfirmModal
    title="Eliminar venta"
    description={`¿Eliminar la póliza ${ventaAEliminar.numeroPoliza}?`}
    onCancel={() => setVentaAEliminar(null)}
    onConfirm={async () => {
      try {
        await api.delete(`/ventas/${ventaAEliminar._id}`);

setVentas(prev =>
  prev.filter(v => v._id !== ventaAEliminar._id)
);

setVentaAEliminar(null);

      } catch (error: any) {
        if (error.response?.status === 403) {
          // EMPLEADO → solo info, NADA MÁS
          setVentaAEliminar(null);
          setShowDeleteInfo(true);
          return;
        }
      }
    }}
  />
)}

{ventaAAnular && (
  <AnularVentaModal
    venta={ventaAAnular}
    solicitud={solicitudSeleccionada}
    onClose={() => setVentaAAnular(null)}
    onConfirm={() => {
      setVentaAAnular(null);
      fetchLibroVentas();
    }}
  />
)}

{ventaARehabilitar && (
  <RehabilitarVentaModal
    venta={ventaARehabilitar}
    solicitud={solicitudSeleccionada}
    onClose={() => {
      setVentaARehabilitar(null);
      setSolicitudSeleccionada(null);
    }}
    onConfirm={() => {
      setVentaARehabilitar(null);
      setSolicitudSeleccionada(null);
      fetchLibroVentas();
    }}
  />
)}




{showDeleteInfo && (
  <InfoModal
    type="delete"
    onClose={() => {
      setShowDeleteInfo(false);
      fetchLibroVentas();
    }}
  />
)}




    </div>
  );
}

/* =========================
   AUX
========================= */
function Select({ label, value, setValue, options }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border rounded px-3 py-2 text-sm cursor-pointer"
      >
        <option value="ALL">Todos</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function FiltroMes({
  mes,
  //anio,
  setMes,
//  setAnio,
 // minPeriodo,
 // maxPeriodo,
}: any) {

  return (
    <div>
      <label className="block text-xs font-semibold mb-1">Mes</label>
      <select
        value={mes}
        onChange={(e) => setMes(Number(e.target.value))}
        className="border rounded px-3 py-2 text-sm cursor-pointer"
      >
        {meses.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
    </div>
  );
}

function FiltroAnio({ anio, setAnio }: any) {
  const y = new Date().getFullYear();
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">Año</label>
      <select
        value={anio}
        onChange={(e) => setAnio(Number(e.target.value))}
        className="border rounded px-3 py-2 text-sm cursor-pointer"
      >
        {[y - 2, y - 1, y, y + 1].map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );
}

function PeriodoSelector({
  mes,
  anio,
  setMes,
  setAnio,
  minPeriodo,
  maxPeriodo,
}: any) {
  // const actual = new Date(anio, mes - 1, 1);

  const isAdmin =
    JSON.parse(localStorage.getItem("user") || "{}")?.role === "admin";

  const prevDate = new Date(anio, mes - 2, 1);
  const nextDate = new Date(anio, mes, 1);

  const prevDisabled = !isAdmin && minPeriodo && prevDate < minPeriodo;
  const nextDisabled = !isAdmin && maxPeriodo && nextDate > maxPeriodo;

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-center justify-between">
      
      {/* ◀ ANTERIOR */}
      <button
        disabled={prevDisabled}
        onClick={() => {
          setMes(prevDate.getMonth() + 1);
          setAnio(prevDate.getFullYear());
        }}
        className="w-9 h-9 flex items-center justify-center
                   rounded-full border border-slate-300
                   text-slate-600 hover:bg-slate-100 hover:text-slate-900
                   disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="Periodo anterior"
      >
        <ChevronLeft size={18} />
      </button>

      {/* TEXTO */}
      <div className="text-center select-none">
        <p className="text-xs text-slate-500 uppercase tracking-wide">
          Periodo
        </p>
        <p className="text-xl font-semibold text-slate-900 leading-tight">
          {mesNombre(mes)} {anio}
        </p>
      </div>

      {/* ▶ SIGUIENTE */}
      <button
        disabled={nextDisabled}
        onClick={() => {
          setMes(nextDate.getMonth() + 1);
          setAnio(nextDate.getFullYear());
        }}
        className="w-9 h-9 flex items-center justify-center
                   rounded-full border border-slate-300
                   text-slate-600 hover:bg-slate-100 hover:text-slate-900
                   disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="Periodo siguiente"
      >
        <ChevronRight size={18} />
      </button>

    </div>
  );
}



const meses = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function mesNombre(mes: number) {
  return meses[mes - 1];
}
