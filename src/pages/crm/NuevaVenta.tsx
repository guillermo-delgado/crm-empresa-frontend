import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CreditCard,
  Euro,
  FilePlus,
  FileText,
  Ban,
  Layers,
  Pencil,
  RotateCcw,
  Save,
  Shield,
  Tag,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import api from "../../services/api";
import InfoModal from "../../components/common/InfoModal";

/* =========================================================
   NUEVA VENTA — ARCHIVO MAESTRO DEL FORMULARIO DE VENTAS

   Un único componente para todo:
     · página completa  /crm/nueva-venta      (con subida/análisis de póliza)
     · modal "crear"    <NuevaVenta modal onClose onSaved />
                        (acceso rápido: 1º subir la póliza → al analizarla se carga
                         el formulario; o "Rellenar manualmente" si no hay PDF)
     · modal "editar"   <NuevaVenta modal modo="editar" venta={...} onClose onSaved />
                        (mismo formulario, datos ya cargados, sin subir póliza;
                         incluye la revisión de solicitudes del admin)
     · modal "rehabilitar" <NuevaVenta modal modo="rehabilitar" venta={...} solicitud={...} />
                        (mismos campos bloqueados + la anulación original para
                         saber por qué se anuló; admin → rehabilita · solicitud de
                         empleado → aprobar / rechazar)
     · modal "eliminar" <NuevaVenta modal modo="eliminar" venta={...} />
                        (mismos campos bloqueados; admin → borra · empleado → solicitud)
     · modal "anular"   <NuevaVenta modal modo="anular" venta={...} solicitud={...} />
                        (mismos campos BLOQUEADOS + datos de la anulación.
                         Empleado → envía solicitud · admin → anula directo ·
                         admin con solicitud abierta → la revisa: aprobar / rechazar)

   Si hay que añadir o quitar un campo, se hace SOLO aquí.
========================================================= */

const BTN = {
  secundario:
    "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  primario:
    "rounded-xl bg-[#2f5bd3] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-10px_rgba(47,91,211,0.7)] transition hover:bg-[#2548b3] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  verde:
    "rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  rojo:
    "rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
} as const;

const ramosDisponibles = [
  "Autos",
  "Hogar",
  "Vida",
  "Accidentes",
  "Salud",
  "Decesos Prima Periodica",
  "Decesos Prima única",
  "Empresa sin multirriesgo",
  "Multirriesgo (074 o 078)",
  "Comunidades",
  "Patinetes",
  "Viajes",
  "Resto",
];

const ACTIVIDADES_SOLO_ADMIN = ["INTERNET", "FINCAS", "COLABORADORES"];

type Usuario = {
  _id: string;
  nombre: string;
  email: string;
  numma?: string;
};

type DatosPolizaAnalizada = {
  fechaEfecto?: string;
  documentoFiscal?: string;
  tomador?: string;
  numeroPoliza?: string;
  aseguradora?: string;
  ramo?: string;
  primaNeta?: string | number;
  formaPago?: string;
};

type NuevaVentaProps = {
  /** "crear" (por defecto), "editar", "anular", "eliminar" o "rehabilitar" una venta existente. */
  modo?: "crear" | "editar" | "anular" | "eliminar" | "rehabilitar";
  /** true → se pinta como modal sobre el libro de ventas (sin navegar). */
  modal?: boolean;
  onClose?: () => void;
  /** Tras guardar (crear / editar) para que el libro se refresque. */
  onSaved?: (patch?: {
    _id: string;
    estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;
    /** eliminar: la venta se ha borrado de verdad (no es solo una solicitud). */
    eliminada?: boolean;
  }) => void;
  /**
   * editar: { data, original, changedFields, solicitudId }
   * anular: la venta (con solicitudId / solicitadoPor si el admin revisa una solicitud)
   */
  venta?: any;
  /** anular / rehabilitar: la solicitud que se está revisando (payload / payloadOrigen). */
  solicitud?: any;
};

const VACIO = {
  fechaEfecto: "",
  aseguradora: "",
  ramo: "",
  numeroPoliza: "",
  documentoFiscal: "",
  tomador: "",
  primaNeta: "",
  formaPago: "",
  actividad: "",
  observaciones: "",
  createdBy: "", // crear: texto escrito · editar: id del usuario
  createdByLabel: "", // texto visible del usuario
  createdAt: "",
};

type FormState = typeof VACIO;

// Convierte cualquier formato a yyyy-mm-dd (para <input type="date">)
function toInputDate(value?: string) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  if (value.includes("/")) {
    const [dd, mm, yyyy] = value.split("/");
    if (dd && mm && yyyy) {
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }

  if (value.includes("T")) return value.substring(0, 10);

  return "";
}

// Fecha para el "Antes: ..." → dd/mm/yyyy
function formatFecha(value?: string) {
  if (!value) return "-";

  if (value.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-ES");
  }

  return value;
}

/**
 * Datos de la anulación de una venta: motivo, tipo de fecha, fecha y Verti.
 * Se buscan en el propio objeto o dentro de un sub-objeto de anulación.
 */
const leerDatosAnulacion = (v: any) => {
  if (!v || typeof v !== "object") return null;

  const o = v.anulacion ?? v.datosAnulacion ?? v.anulacionInfo ?? v.payloadAnulacion;
  const src = o && typeof o === "object" ? o : v;

  const motivo = src.motivo ?? src.motivoAnulacion;
  const fechaTipo = src.fechaTipo ?? src.fechaTipoAnulacion;
  const fechaAnulacion = src.fechaAnulacion;
  const derivadoVerti = src.derivadoVerti;

  if (!motivo && !fechaTipo && !fechaAnulacion && derivadoVerti === undefined) return null;

  return { motivo, fechaTipo, fechaAnulacion, derivadoVerti };
};

const formDesdeVenta = (v: any): FormState => ({
  ...VACIO,
  fechaEfecto: toInputDate(
    typeof v?.fechaEfecto === "string" ? v.fechaEfecto : ""
  ),
  createdByLabel:
    v?.createdBy?.numma || v?.createdBy?.nombre || v?.createdBy?.email || "",
  aseguradora: v?.aseguradora || "",
  ramo: v?.ramo || "",
  numeroPoliza: v?.numeroPoliza || "",
  tomador: v?.tomador || "",
  documentoFiscal: v?.documentoFiscal || "",
  primaNeta: v?.primaNeta?.toString() || "",
  formaPago: v?.formaPago || "",
  actividad: v?.actividad || "",
  observaciones: v?.observaciones || "",
});

const INPUT =
  "w-full bg-transparent px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-default disabled:text-slate-500";

const NuevaVenta = ({
  modo = "crear",
  modal = false,
  onClose,
  onSaved,
  venta,
  solicitud,
}: NuevaVentaProps = {}) => {
  const navigate = useNavigate();

  const esCrear = modo === "crear";
  const esEditar = modo === "editar";
  const esAnular = modo === "anular";
  const esEliminar = modo === "eliminar";
  const esRehabilitar = modo === "rehabilitar";
  const conDatos = !esCrear; // editar, anular y eliminar parten de una venta existente

  const dateRef = useRef<HTMLInputElement>(null);
  const polizaInputRef = useRef<HTMLInputElement>(null);
  const observacionesRef = useRef<HTMLTextAreaElement>(null);
  const pulsoEnFondo = useRef(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  /* ---------- Datos de la venta (solo editar) ---------- */
  const ventaData = venta?.data ?? (venta as any);
  const originalData = venta?.original ?? null;
  const changedFields: string[] = venta?.changedFields ?? [];

  const isSolicitud = esEditar && isAdmin && !!venta?.solicitudId && changedFields.length > 0;
  const isDelete = changedFields.includes("__DELETE__");
  const anulada = esEditar && ventaData?.estado === "ANULADA";

  /* ---------- Anular ---------- */
  // El admin REVISA una solicitud de un empleado (todo bloqueado, aprobar / rechazar)
  const esRevision = esAnular && !!venta?.solicitudId;
  // Empleado con una solicitud ya enviada para esta venta
  const haySolicitudPendiente =
    esAnular && !esRevision && !isAdmin && ventaData?.estadoRevision === "pendiente";
  // Los campos de la venta van bloqueados al anular, eliminar y rehabilitar
  const bloqueado = esAnular || esEliminar || esRehabilitar;

  /* ---------- Rehabilitar ---------- */
  // Admin desde la tabla: rehabilitación directa (solicitud "local", no es real)
  const directo = esRehabilitar && !!solicitud?.local;
  // Una solicitud real exige que la venta siga anulada
  const errorEstado =
    esRehabilitar && !directo && ventaData?.estado !== "ANULADA"
      ? "La venta no está anulada"
      : null;
  const [sinDatosAnulacion, setSinDatosAnulacion] = useState(false);

  const payloadAnulacion = esRehabilitar ? null : solicitud?.payload ?? venta?.payload;
  const [fechaTipo, setFechaTipo] = useState<"VENCIMIENTO" | "FECHA">(
    payloadAnulacion?.fechaTipo || "VENCIMIENTO"
  );
  const [fechaAnulacion, setFechaAnulacion] = useState(
    toInputDate(payloadAnulacion?.fechaAnulacion)
  );
  const [motivo, setMotivo] = useState<string>(payloadAnulacion?.motivo || "");
  const [derivadoVerti, setDerivadoVerti] = useState(!!payloadAnulacion?.derivadoVerti);

  // Página: subida + formulario a la vez.
  // Modal crear: primero se sube la póliza (o se elige "manual") y luego sale el formulario.
  const [paso, setPaso] = useState<"subir" | "formulario">(
    modal && esCrear ? "subir" : "formulario"
  );
  const enPasoSubir = modal && esCrear && paso === "subir";
  const mostrarSubida = esCrear && (!modal || paso === "subir");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [form, setForm] = useState<FormState>(() =>
    conDatos ? formDesdeVenta(ventaData) : VACIO
  );

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [ventaHistorica, setVentaHistorica] = useState(false);

  /* =========================================================
     ANÁLISIS DE PÓLIZA
     ========================================================= */

  const [analizandoPoliza, setAnalizandoPoliza] = useState(false);
  const [polizaAnalizada, setPolizaAnalizada] = useState(false);
  const [errorAnalisisPoliza, setErrorAnalisisPoliza] =
    useState<string | null>(null);

  const [dragActive, setDragActive] = useState(false);

  const [datosAnalizados, setDatosAnalizados] =
    useState<DatosPolizaAnalizada | null>(null);

  const [nombreDocumentoAnalizado, setNombreDocumentoAnalizado] =
    useState("");

  /* =========================================================
     BUSCADOR CLIENTE POR NIF
     ========================================================= */

  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false);
  const [clienteNoEncontrado, setClienteNoEncontrado] = useState(false);

  /* =========================================================
     FECHA HISTÓRICA
     ========================================================= */

  useEffect(() => {
    if (!ventaHistorica) {
      setForm((f) => ({
        ...f,
        createdAt: "",
      }));
    }
  }, [ventaHistorica]);

  /* =========================================================
     CARGAR USUARIOS
     ========================================================= */

  useEffect(() => {
    if (!isAdmin) return;

    api
      .get("/users/asignables")
      .then((res) => setUsuarios(res.data))
      .catch(() => {});
  }, [isAdmin]);

  /* =========================================================
     ALTURA AUTOMÁTICA DE OBSERVACIONES
     ========================================================= */

  useEffect(() => {
    const el = observacionesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [form.observaciones]);

  /* =========================================================
     REHABILITAR: cargar la anulación original (por qué se anuló)
     ========================================================= */

  useEffect(() => {
    if (!esRehabilitar) return;

    const aplicar = (d: NonNullable<ReturnType<typeof leerDatosAnulacion>>) => {
      setMotivo(d.motivo || "");
      setFechaTipo(d.fechaTipo === "FECHA" ? "FECHA" : "VENCIMIENTO");
      setFechaAnulacion(toInputDate(d.fechaAnulacion));
      setDerivadoVerti(!!d.derivadoVerti);
      setSinDatosAnulacion(false);
    };

    // 1) la solicitud (payloadOrigen) · 2) la propia venta
    const inicial = leerDatosAnulacion(solicitud?.payloadOrigen) ?? leerDatosAnulacion(ventaData);

    if (inicial) {
      aplicar(inicial);
      return;
    }

    // 3) la venta completa desde el servidor
    let vivo = true;

    api
      .get(`/ventas/${ventaData._id}`)
      .then((res) => {
        if (!vivo) return;
        const d = leerDatosAnulacion(res.data?.venta ?? res.data);
        if (d) aplicar(d);
        else setSinDatosAnulacion(true);
      })
      .catch(() => vivo && setSinDatosAnulacion(true));

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     ESC CIERRA EL MODAL
     ========================================================= */

  useEffect(() => {
    if (!modal) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando && !showInfo && !showSuccess) onClose?.();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, guardando, showInfo, showSuccess, onClose]);

  /* =========================================================
     CAMBIO CAMPOS
     ========================================================= */

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    setForm((actual) => ({
      ...actual,
      [name]: value,
    }));

    if (name === "documentoFiscal") {
      setClienteEncontrado(false);
      setClienteNoEncontrado(false);
    }
  };

  /* Usuario: al crear se manda el texto; al editar se traduce a id */
  const cambiarUsuario = (value: string) => {
    if (esCrear) {
      setForm((f) => ({ ...f, createdBy: value, createdByLabel: value }));
      return;
    }

    const u = usuarios.find(
      (u) => u.nombre === value || u.numma === value || u.email === value
    );

    setForm((f) => ({ ...f, createdByLabel: value, createdBy: u ? u._id : "" }));
  };

  /* =========================================================
     BUSCAR CLIENTE POR NIF
     ========================================================= */

  const buscarClientePorDocumento = async (
    documento?: string
  ) => {
    // Solo al crear: al editar / anular no se pisa el tomador de la venta.
    if (!esCrear) return;

    const valor = String(
      documento ?? form.documentoFiscal
    )
      .trim()
      .toUpperCase();

    if (!valor) {
      setClienteEncontrado(false);
      setClienteNoEncontrado(false);
      return;
    }

    /*
     * Evitamos búsquedas con documentos demasiado cortos.
     */
    if (valor.length < 6) {
      setClienteEncontrado(false);
      setClienteNoEncontrado(false);
      return;
    }

    setBuscandoCliente(true);
    setClienteEncontrado(false);
    setClienteNoEncontrado(false);

    try {
      const res = await api.get(
        "/ventas/buscar-cliente",
        {
          params: {
            documentoFiscal: valor,
          },
        }
      );

      const cliente = res.data?.cliente;

if (cliente?.tomador) {
  setForm((actual) => ({
    ...actual,
    documentoFiscal: valor,
    tomador: cliente.tomador,
  }));

  setClienteEncontrado(true);
  setClienteNoEncontrado(false);
} else {
  setClienteEncontrado(false);
  setClienteNoEncontrado(true);
}
    } catch (err: any) {
      /*
       * Un fallo de búsqueda no debe impedir crear
       * una venta nueva.
       */
      console.error(
        "ERROR BUSCANDO CLIENTE POR NIF:",
        err
      );

      setClienteEncontrado(false);
      setClienteNoEncontrado(false);
    } finally {
      setBuscandoCliente(false);
    }
  };


  /* =========================================================
     ANALIZAR PÓLIZA
     ========================================================= */

  const analizarPoliza = async (file: File) => {
    setError(null);
    setErrorAnalisisPoliza(null);
    setPolizaAnalizada(false);
    setDatosAnalizados(null);
    setAnalizandoPoliza(true);

    try {
      const formData = new FormData();

      // El archivo solo se envía al endpoint de análisis.
      formData.append("poliza", file);

      const res = await api.post(
        "/ventas/analizar-poliza",
        formData
      );

      const datos: DatosPolizaAnalizada =
      res.data?.datos || res.data;

    setDatosAnalizados(datos);

    setForm((actual) => ({
      ...actual,
      fechaEfecto: datos.fechaEfecto ?? "",
      documentoFiscal: datos.documentoFiscal
        ? String(datos.documentoFiscal).toUpperCase()
        : "",
      tomador: datos.tomador ?? "",
      numeroPoliza: datos.numeroPoliza ?? "",
      aseguradora: datos.aseguradora ?? "",
      ramo: datos.ramo ?? "",
      primaNeta:
        datos.primaNeta !== undefined &&
        datos.primaNeta !== null
          ? String(datos.primaNeta)
          : "",
      formaPago: datos.formaPago ?? "",
    }));

    setPolizaAnalizada(true);
    setNombreDocumentoAnalizado(file.name);
    setPaso("formulario");

    if (datos.documentoFiscal) {
      await buscarClientePorDocumento(
        String(datos.documentoFiscal)
      );
    }

  } catch (err: any) {
      console.error(
        "ERROR ANALIZANDO PÓLIZA:",
        err
      );

      setErrorAnalisisPoliza(
        err.response?.data?.message ||
          "No se ha podido analizar la póliza."
      );
    } finally {
      setAnalizandoPoliza(false);
    }
  };

  /* =========================================================
     SELECCIONAR ARCHIVO
     ========================================================= */

  const seleccionarPoliza = async (
    file?: File
  ) => {
    if (!file) return;

    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      file.type !== "application/pdf" &&
      extension !== "pdf"
    ) {
      setErrorAnalisisPoliza(
        "Solo puedes subir archivos PDF."
      );

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setErrorAnalisisPoliza(
        "El documento no puede superar los 10 MB."
      );

      return;
    }

    await analizarPoliza(file);
  };

  const handlePolizaChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    await seleccionarPoliza(file);

    e.target.value = "";
  };

  /* =========================================================
     DRAG & DROP
     ========================================================= */

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragActive(true);
  };

  const handleDragLeave = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragActive(false);
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragActive(false);

    const file =
      e.dataTransfer.files?.[0];

    if (!file) return;

    await seleccionarPoliza(file);
  };

  /* =========================================================
     LIMPIAR FORMULARIO
     ========================================================= */

  const limpiarFormulario = () => {
    setForm(VACIO);

    setPolizaAnalizada(false);
    setErrorAnalisisPoliza(null);
    setDatosAnalizados(null);
    setNombreDocumentoAnalizado("");
    setError(null);
    setVentaHistorica(false);

    setClienteEncontrado(false);
    setClienteNoEncontrado(false);
    setBuscandoCliente(false);
  };

  /* =========================================================
     GUARDAR (crear / editar)
     ========================================================= */

  const crearVenta = async () => {
    // La póliza analizada nunca se adjunta a la venta.
    const formData = new FormData();

    formData.append("fechaEfecto", form.fechaEfecto);
    formData.append("aseguradora", form.aseguradora);
    formData.append("ramo", form.ramo);
    formData.append("numeroPoliza", form.numeroPoliza);
    formData.append("documentoFiscal", form.documentoFiscal);
    formData.append("tomador", form.tomador);
    formData.append("primaNeta", String(Number(form.primaNeta)));
    formData.append("formaPago", form.formaPago);
    formData.append("actividad", form.actividad);
    formData.append("observaciones", form.observaciones);

    // USUARIO ASIGNADO
    if (isAdmin && form.createdBy) {
      formData.append("createdBy", form.createdBy);
    }

    // VENTA HISTÓRICA
    if (isAdmin && ventaHistorica && form.createdAt) {
      formData.append("createdAt", form.createdAt);
    }

    await api.post("/ventas", formData);

    if (modal) {
      onSaved?.();
      onClose?.();
    } else {
      setShowSuccess(true);
    }
  };

  const editarVenta = async () => {
    const nif = form.documentoFiscal.trim();

    if (nif !== "" && nif.length < 9) {
      setError("El NIF / NIE / CIF no es válido");
      return;
    }

    // El DNI solo se envía si realmente cambia.
    const documentoFiscalOriginal = ventaData.documentoFiscal?.trim() || "";
    const documentoFiscalHaCambiado = (nif || undefined) !== documentoFiscalOriginal;

    const payload: any = {
      fechaEfecto: form.fechaEfecto,
      aseguradora: form.aseguradora,
      ramo: form.ramo,
      numeroPoliza: form.numeroPoliza,
      tomador: form.tomador,
      primaNeta: Number(form.primaNeta),
      formaPago: form.formaPago,
      actividad: form.actividad,
      observaciones: form.observaciones,
      createdBy: form.createdBy || ventaData.createdBy?._id,
    };

    if (documentoFiscalHaCambiado) {
      payload.documentoFiscal = nif || undefined;
    }

    await api.put(`/ventas/${ventaData._id}`, payload);

    onSaved?.({ _id: ventaData._id });
    onClose?.();
  };

  const anularVenta = async () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio.");
      return;
    }

    if (fechaTipo === "FECHA" && !fechaAnulacion) {
      setError("Debes seleccionar la fecha.");
      return;
    }

    // Admin → se anula directamente. Empleado → el backend responde 403 y
    // deja creada la solicitud (comportamiento esperado).
    await api.post(`/ventas/${ventaData._id}/anular`, {
      fechaTipo,
      fechaAnulacion: fechaTipo === "FECHA" ? fechaAnulacion : undefined,
      motivo: motivo.trim(),
      derivadoVerti,
    });

    onSaved?.();
    onClose?.();
  };

  const rehabilitarVenta = async () => {
    if (errorEstado) return;

    try {
      if (directo) {
        await api.put(`/ventas/${ventaData._id}`, { estado: null });
      } else if (solicitud?._id) {
        await api.post(`/solicitudes/${solicitud._id}/aprobar`);
      } else {
        throw new Error("sin-solicitud");
      }
    } catch (err: any) {
      // Error propio (para poder reintentar y distinguirlo del resto)
      throw Object.assign(err, {
        mensajeFinal: err?.response?.data?.message || "Error aprobando la rehabilitación",
      });
    }

    onSaved?.();
    onClose?.();
  };

  const rechazarRehabilitacion = async () => {
    if (!solicitud?._id) return;

    setError(null);
    setGuardando(true);

    try {
      await api.post(`/solicitudes/${solicitud._id}/rechazar`);
      onClose?.();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Error rechazando la rehabilitación");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarVenta = async () => {
    // Admin → se borra. Empleado → el backend responde 403 y deja creada
    // la solicitud de eliminación (comportamiento esperado).
    await api.delete(`/ventas/${ventaData._id}`);

    onSaved?.({ _id: ventaData._id, eliminada: true });
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // En la revisión de una solicitud no se guarda: se acepta o se rechaza.
    if (isSolicitud || anulada || esRevision) return;

    setError(null);
    setGuardando(true);

    try {
      if (esRehabilitar) await rehabilitarVenta();
      else if (esEliminar) await eliminarVenta();
      else if (esAnular) await anularVenta();
      else if (esEditar) await editarVenta();
      else await crearVenta();
    } catch (err: any) {
      const status = err?.response?.status;

      // EMPLEADO eliminando → 403 = solicitud de eliminación creada
      if (esEliminar && status === 403) {
        setShowInfo(true);
        return;
      }

      // EMPLEADO anulando → 403 = solicitud enviada correctamente
      if (esAnular && status === 403) {
        onSaved?.();
        onClose?.();
        return;
      }

      // EMPLEADO editando → 403 = solicitud enviada correctamente
      if (esEditar && status === 403) {
        onClose?.();
        return;
      }

      if (esRehabilitar) {
        setError(err?.mensajeFinal || "Error aprobando la rehabilitación");
        return;
      }

      console.error(
        esEliminar
          ? "ERROR ELIMINANDO VENTA:"
          : esAnular
          ? "ERROR ANULANDO VENTA:"
          : esEditar
          ? "ERROR EDITANDO VENTA:"
          : "ERROR GUARDANDO VENTA:",
        err
      );

      setError(
        err.response?.data?.message ||
          (esEliminar
            ? "Se ha producido un error al eliminar la venta."
            : esAnular
            ? "Error de conexión"
            : esEditar
            ? "No se ha podido guardar la venta."
            : "Error inesperado al guardar la venta")
      );
    } finally {
      setGuardando(false);
    }
  };

  /* =========================================================
     SOLO EDITAR: venta anulada y revisión de solicitudes (admin)
     ========================================================= */

  const solicitarRehabilitacion = async () => {
    try {
      await api.post(
        `/ventas/${ventaData._id}/rehabilitar`,
        {},
        { validateStatus: (status) => status === 403 || status < 400 }
      );
    } catch (err: any) {
      // 403 = solicitud creada correctamente (comportamiento esperado)
      if (err?.response?.status !== 403) {
        console.error("❌ Error inesperado solicitando rehabilitación", err);
      }
    } finally {
      setShowInfo(true);
    }
  };

  const resolver = async (accion: "aprobar" | "rechazar") => {
    setError(null);
    setGuardando(true);

    try {
      await api.post(`/solicitudes/${venta?.solicitudId}/${accion}`);
      if (esAnular && accion === "aprobar") onSaved?.();
      onClose?.();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          `Error ${accion === "aprobar" ? "aprobando" : "rechazando"} la solicitud`
      );
    } finally {
      setGuardando(false);
    }
  };

  const eliminarDefinitivo = async () => {
    setError(null);
    setGuardando(true);

    try {
      await api.delete(`/ventas/${ventaData._id}`);
      await api.post(`/solicitudes/${venta?.solicitudId}/aprobar`);
      onClose?.();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Error eliminando la venta");
    } finally {
      setGuardando(false);
    }
  };

  /* =========================================================
     "Antes: ..." (solo editar, campos que ha cambiado el empleado)
     ========================================================= */

  const normalizar = (campo: keyof FormState, valor: any) => {
    if (valor === undefined || valor === null) return "";
    if (campo === "fechaEfecto") return String(valor).slice(0, 10);
    if (campo === "primaNeta") return Number(valor);
    return String(valor).trim();
  };

  const antes = (campo: keyof FormState, mostrar?: (v: any) => string) => {
    if (!esEditar || !originalData) return null;
    if (normalizar(campo, originalData[campo]) === normalizar(campo, form[campo])) {
      return null;
    }

    const v = originalData[campo];
    return (
      <p className="mt-1 text-xs font-medium text-red-600">
        Antes: {mostrar ? mostrar(v) : v ?? "-"}
      </p>
    );
  };

  const actividadExclusivaActual =
    !isAdmin && ACTIVIDADES_SOLO_ADMIN.includes(form.actividad);

  /* =========================================================
     BARRA INFERIOR
     ========================================================= */

  const cancelar = (
    <button type="button" onClick={onClose} disabled={guardando} className={BTN.secundario}>
      Cancelar
    </button>
  );

  let pieIzquierda: React.ReactNode = null;
  let pieDerecha: React.ReactNode = null;

  if (esRehabilitar) {
    pieDerecha = (
      <>
        {directo ? (
          cancelar
        ) : (
          <button
            type="button"
            onClick={rechazarRehabilitacion}
            disabled={guardando}
            className={BTN.secundario}
          >
            Rechazar
          </button>
        )}

        <button type="submit" disabled={guardando || !!errorEstado} className={BTN.verde}>
          {guardando ? "Procesando..." : "Rehabilitar venta"}
        </button>
      </>
    );
  } else if (esEliminar) {
    pieDerecha = (
      <>
        {cancelar}
        <button type="submit" disabled={guardando} className={BTN.rojo}>
          {guardando ? "Procesando..." : isAdmin ? "Eliminar" : "Solicitar eliminación"}
        </button>
      </>
    );
  } else if (esAnular) {
    if (esRevision) {
      pieDerecha = (
        <>
          <button
            type="button"
            onClick={() => resolver("rechazar")}
            disabled={guardando}
            className={BTN.secundario}
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => resolver("aprobar")}
            disabled={guardando}
            className={BTN.verde}
          >
            {guardando ? "Procesando..." : "Aprobar"}
          </button>
        </>
      );
    } else {
      pieDerecha = (
        <>
          {cancelar}
          <button
            type="submit"
            disabled={guardando || haySolicitudPendiente}
            className={BTN.rojo}
          >
            {haySolicitudPendiente
              ? "Solicitud enviada"
              : guardando
              ? "Enviando..."
              : isAdmin
              ? "Anular venta"
              : "Enviar solicitud"}
          </button>
        </>
      );
    }
  } else if (esEditar) {
    if (isSolicitud) {
      pieDerecha = (
        <>
          <button
            type="button"
            onClick={() => resolver("aprobar")}
            disabled={guardando}
            className={BTN.verde}
          >
            Aceptar cambios
          </button>

          {!isDelete && (
            <button
              type="button"
              onClick={() => resolver("rechazar")}
              disabled={guardando}
              className={BTN.secundario}
            >
              Rechazar
            </button>
          )}

          {isDelete && (
            <button
              type="button"
              onClick={eliminarDefinitivo}
              disabled={guardando}
              className={BTN.rojo}
            >
              Eliminar
            </button>
          )}
        </>
      );
    } else if (!anulada) {
      pieDerecha = (
        <>
          {cancelar}
          <button type="submit" disabled={guardando} className={BTN.primario}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      );
    }
  } else if (modal) {
    pieIzquierda = (
      <button
        type="button"
        onClick={() => setPaso("subir")}
        disabled={guardando}
        className={`${BTN.secundario} flex items-center gap-2`}
      >
        <Upload size={16} />
        {polizaAnalizada ? "Cambiar póliza" : "Subir póliza"}
      </button>
    );

    pieDerecha = (
      <>
        {cancelar}
        <button type="submit" disabled={guardando} className={BTN.primario}>
          {guardando ? "Guardando..." : "Guardar venta"}
        </button>
      </>
    );
  } else {
    pieIzquierda = (
      <button
        type="button"
        onClick={limpiarFormulario}
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#eef1fa] cursor-pointer"
      >
        <RotateCcw size={16} />
        Limpiar formulario
      </button>
    );

    pieDerecha = (
      <button
        type="submit"
        disabled={showSuccess || analizandoPoliza || guardando}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#2f5bd3] px-8 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-10px_rgba(47,91,211,0.7)] transition hover:bg-[#2548b3] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save size={17} />
        {guardando ? "Guardando..." : "Guardar venta"}
      </button>
    );
  }

  /* Estado de la búsqueda de cliente: va en la línea de la etiqueta del NIF */
  const estadoCliente = !esCrear ? null : buscandoCliente ? (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#2f5bd3]" />
      Buscando...
    </span>
  ) : clienteEncontrado ? (
    <span
      className="text-xs font-semibold text-green-700"
      title="Se ha cargado el tomador del cliente"
    >
      ✓ Cliente encontrado
    </span>
  ) : clienteNoEncontrado ? (
    <span
      className="text-xs text-slate-500"
      title="No existe un cliente registrado con este documento"
    >
      Cliente nuevo
    </span>
  ) : null;

  const campoUsuario = isAdmin ? (
    <Field label="Usuario">
      <InputWrapper icon={User}>
        <input
          list="usuarios-list"
          value={form.createdByLabel}
          onChange={(e) => cambiarUsuario(e.target.value)}
          className={INPUT}
          placeholder="Escribe para buscar usuario"
        />

        <datalist id="usuarios-list">
          {usuarios.map((u) => (
            <option key={u._id} value={u.numma || u.nombre || u.email}>
              {u.nombre} ({u.email})
            </option>
          ))}
        </datalist>
      </InputWrapper>
    </Field>
  ) : null;

  /* Una sola celda: interruptor y, si está activo, la fecha de creación */
  const campoHistorica =
    esCrear && isAdmin ? (
      <Field label="Venta histórica" className={modal ? "lg:col-span-2" : ""}>
        <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
          <button
            type="button"
            role="switch"
            aria-checked={ventaHistorica}
            onClick={() => setVentaHistorica((v) => !v)}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              ventaHistorica ? "bg-[#2f5bd3]" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                ventaHistorica ? "translate-x-5" : ""
              }`}
            />
          </button>

          {ventaHistorica ? (
            <>
              <span className="shrink-0 text-xs text-slate-500">Fecha de creación</span>
              <input
                type="date"
                name="createdAt"
                value={form.createdAt}
                onChange={handleChange}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm text-slate-700 outline-none"
              />
            </>
          ) : (
            <span className="truncate text-xs text-slate-500">
              Solo para ventas anteriores a la fecha actual
            </span>
          )}
        </div>
      </Field>
    ) : null;

  const titulo = esRehabilitar
    ? "Rehabilitar venta"
    : esEliminar
    ? "Eliminar venta"
    : esAnular
    ? "Anular venta"
    : esEditar
    ? isDelete
      ? "Eliminar venta"
      : "Editar venta"
    : "Nueva venta";
  const subtitulo = esRehabilitar
    ? directo
      ? "Estás a punto de rehabilitar una venta previamente anulada"
      : "Revisa la solicitud de rehabilitación enviada por el empleado"
    : esEliminar
    ? isAdmin
      ? `¿Eliminar la póliza ${ventaData?.numeroPoliza || ""}? Esta acción no se puede deshacer`
      : "Se enviará una solicitud de eliminación para que el administrador la revise"
    : esAnular
    ? esRevision
      ? "Revisa la solicitud de anulación enviada por el empleado"
      : isAdmin
      ? "La venta se anulará directamente"
      : "Esta acción generará una solicitud de anulación para revisión"
    : esEditar
    ? isSolicitud
      ? "Revisa los cambios solicitados"
      : ""
    : enPasoSubir
      ? "Sube la póliza y se rellenarán los datos automáticamente"
      : "Registra una nueva póliza en el sistema";
  const IconoCabecera = esRehabilitar
    ? RotateCcw
    : esEliminar
    ? Trash2
    : esAnular
    ? Ban
    : esEditar
    ? Pencil
    : FilePlus;

  const contenido = (
    <div
      className={
        modal
          ? `relative w-full ${
              enPasoSubir ? "max-w-2xl" : "max-w-5xl"
            } rounded-3xl bg-[#f1f3f8] p-4 shadow-2xl sm:p-5`
          : "max-w-7xl mx-auto"
      }
    >

        {/* =====================================================
            CABECERA
        ===================================================== */}

        <div
          className={
            modal
              ? "mb-4 flex items-center justify-between gap-4"
              : "flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-6"
          }
        >

          <div className="flex items-center gap-4">

            <div
              className={`${
                modal ? "h-12 w-12" : "h-14 w-14"
              } rounded-2xl bg-gradient-to-br from-[#2f5bd3] to-[#5b8def] flex items-center justify-center text-white shadow-[0_12px_24px_-12px_rgba(47,91,211,0.8)]`}
            >
              <IconoCabecera size={modal ? 24 : 30} strokeWidth={1.8} />
            </div>

            <div>

              <h1
                className={`${
                  modal ? "text-2xl" : "text-3xl"
                } font-bold tracking-tight text-slate-900`}
              >
                {titulo}
              </h1>

              {subtitulo && (
                <p className="text-slate-500 mt-0.5 text-sm">{subtitulo}</p>
              )}

            </div>

          </div>

          {modal ? (
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              aria-label="Cerrar"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed"
            >
              <X size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/crm/libro-ventas")}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200/80 rounded-full text-slate-700 font-semibold shadow-sm transition hover:bg-[#eef1fa] hover:text-[#2f5bd3] cursor-pointer"
            >
              <span className="text-xl">←</span>
              Volver al libro de ventas
            </button>
          )}

        </div>

        {/* =====================================================
            VENTA ANULADA (solo editar)
        ===================================================== */}

        {anulada && (
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-medium text-red-700">Esta venta está anulada</span>

            <button
              type="button"
              onClick={solicitarRehabilitacion}
              className="ml-auto rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 cursor-pointer"
            >
              Solicitar rehabilitación
            </button>
          </div>
        )}

        {/* =====================================================
            BLOQUE PÓLIZA (página; en el modal solo es el primer paso)
        ===================================================== */}

        {mostrarSubida && (
        <div className={`bg-white border border-slate-200/70 rounded-3xl shadow-[0_1px_2px_rgba(29,36,51,0.04),0_14px_34px_-20px_rgba(29,36,51,0.25)] p-4 ${modal ? "" : "mb-5"}`}>

          <div className={`grid grid-cols-1 gap-4 ${modal ? "" : "lg:grid-cols-2"}`}>

            {/* =================================================
                SUBIR DOCUMENTO
            ================================================= */}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() =>
                polizaInputRef.current?.click()
              }
              className={`min-h-[250px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center px-6 transition-all cursor-pointer ${
                dragActive
                  ? "border-[#2f5bd3] bg-[#e3eafb]"
                  : "border-[#b9c6ea] bg-[#f5f7fc] hover:border-[#2f5bd3] hover:bg-[#eef2fc]"
              }`}
            >

              <div className="w-14 h-14 rounded-2xl bg-[#e3eafb] flex items-center justify-center mb-4">

                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2f5bd3]"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line
                    x1="12"
                    y1="12"
                    x2="12"
                    y2="18"
                  />
                  <line
                    x1="9"
                    y1="15"
                    x2="15"
                    y2="15"
                  />
                </svg>

              </div>

              <h2 className="text-xl font-bold text-slate-800">
                Subir póliza
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                Arrastra aquí el PDF de la póliza
                <br />
                de la póliza, o pulsa para seleccionar
              </p>

              <input
                ref={polizaInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={
                  handlePolizaChange
                }
                className="hidden"
              />

              <button
                type="button"
                disabled={
                  analizandoPoliza
                }
                onClick={(e) => {
                  e.stopPropagation();

                  polizaInputRef.current?.click();
                }}
                className="mt-5 px-7 py-3 rounded-xl bg-[#2f5bd3] text-white shadow-[0_10px_22px_-10px_rgba(47,91,211,0.7)] font-semibold hover:bg-[#2548b3] disabled:opacity-50 cursor-pointer"
              >
                {analizandoPoliza
                  ? "Analizando documento..."
                  : "Seleccionar archivo"}
              </button>

              <p className="text-xs text-slate-400 mt-3">
                PDF · máx. 10 MB
              </p>

              {nombreDocumentoAnalizado && (
                <p className="text-xs font-semibold text-slate-600 mt-2 truncate max-w-full">
                  {nombreDocumentoAnalizado}
                </p>
              )}

            </div>

            {/* =================================================
                RESULTADO
            ================================================= */}

            {!modal && (
            <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] p-5">

              {!polizaAnalizada ? (

                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center">

                  <div className="w-12 h-12 rounded-full bg-[#e3eafb] flex items-center justify-center mb-3">

                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-slate-500"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                      />
                      <line
                        x1="12"
                        y1="8"
                        x2="12"
                        y2="12"
                      />
                      <line
                        x1="12"
                        y1="16"
                        x2="12.01"
                        y2="16"
                      />
                    </svg>

                  </div>

                  <h2 className="text-lg font-bold text-slate-700">
                    Documento pendiente
                  </h2>

                  <p className="text-sm text-slate-500 mt-1 max-w-md">
                    Sube una póliza para extraer automáticamente sus datos.
                  </p>

                  {errorAnalisisPoliza && (
                    <div className="mt-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
                      {errorAnalisisPoliza}
                    </div>
                  )}

                </div>

              ) : (

                <div>

                  <div className="flex items-center gap-3 mb-5">

                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">

                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-600"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>

                    </div>

                    <div>

                      <h2 className="text-lg font-bold text-green-700">
                        Documento analizado correctamente
                      </h2>

                      <p className="text-sm text-slate-500">
                        Se han extraído los siguientes datos. Revísalos antes de guardar.
                      </p>

                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">

                    <AnalisisDato
                      label="Número de póliza"
                      value={
                        datosAnalizados?.numeroPoliza
                      }
                    />

                    <AnalisisDato
                      label="N.I.F."
                      value={
                        datosAnalizados?.documentoFiscal
                      }
                    />

                    <AnalisisDato
                      label="Tomador"
                      value={
                        datosAnalizados?.tomador
                      }
                    />

                    <AnalisisDato
                      label="Fecha de efecto"
                      value={
                        datosAnalizados?.fechaEfecto
                      }
                    />

                    <AnalisisDato
                      label="Aseguradora"
                      value={
                        datosAnalizados?.aseguradora
                      }
                    />

                    <AnalisisDato
                      label="Ramo"
                      value={
                        datosAnalizados?.ramo
                      }
                    />

                    <AnalisisDato
                      label="Forma de pago"
                      value={
                        datosAnalizados?.formaPago
                      }
                    />

                    <AnalisisDato
                      label="Prima neta"
                      value={
                        datosAnalizados?.primaNeta
                          ? `${datosAnalizados.primaNeta} €`
                          : ""
                      }
                    />

                  </div>

                </div>

              )}

            </div>
            )}

          </div>

          {/* Solo en el modal: error de análisis y opción manual */}
          {modal && (
            <>
              {errorAnalisisPoliza && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {errorAnalisisPoliza}
                </div>
              )}

              <div className="mt-5 flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-slate-500">¿No tienes la póliza en PDF?</p>

                <button
                  type="button"
                  onClick={() => setPaso("formulario")}
                  disabled={analizandoPoliza}
                  className={BTN.secundario}
                >
                  Rellenar manualmente
                </button>
              </div>
            </>
          )}

        </div>
        )}

        {/* Modal: aviso tras analizar la póliza */}
        {modal && esCrear && !enPasoSubir && polizaAnalizada && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm">
            <span className="font-semibold text-green-700">
              Póliza analizada{nombreDocumentoAnalizado ? `: ${nombreDocumentoAnalizado}` : ""}
            </span>
            <span className="text-slate-600">Revisa los datos antes de guardar.</span>
          </div>
        )}

        {/* =====================================================
            FORMULARIO
        ===================================================== */}

        {!enPasoSubir && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200/70 rounded-3xl shadow-[0_1px_2px_rgba(29,36,51,0.04),0_14px_34px_-20px_rgba(29,36,51,0.25)] overflow-hidden"
        >

          <fieldset
            disabled={bloqueado}
            className={`grid min-w-0 grid-cols-1 md:grid-cols-2 ${
              modal ? "lg:grid-cols-3 gap-x-6 gap-y-4 p-5" : "gap-x-8 gap-y-5 p-6"
            }`}
          >

            {/* FECHA */}

            <Field label="Fecha de efecto" required>
              <InputWrapper icon={Calendar}>
                <input
                  ref={dateRef}
                  type="date"
                  name="fechaEfecto"
                  value={form.fechaEfecto}
                  onChange={handleChange}
                  onClick={() => dateRef.current?.showPicker?.()}
                  className={`${INPUT} cursor-pointer`}
                  required
                />
              </InputWrapper>
              {antes("fechaEfecto", formatFecha)}
            </Field>

            {/* Modal: Fecha | Usuario | ...   ·   Página: Fecha | Venta histórica | Usuario | ... */}
            {modal ? (
              campoUsuario
            ) : (
              <>
                {campoHistorica}
                {campoUsuario}
              </>
            )}

            {/* ASEGURADORA */}

            <Field label="Aseguradora" required>
              <InputWrapper icon={Shield}>
                <select
                  name="aseguradora"
                  value={form.aseguradora}
                  onChange={handleChange}
                  className={`${INPUT} cursor-pointer`}
                  required
                >
                  <option value="">Selecciona aseguradora</option>
                  <option value="Mapfre">Mapfre</option>
                  <option value="Verti">Verti</option>
                </select>
              </InputWrapper>
              {antes("aseguradora")}
            </Field>

            {/* NIF + BUSCADOR */}

            <Field label="N.I.F / N.I.E / C.I.F" required extra={estadoCliente}>
              <InputWrapper icon={CreditCard}>
                <input
                  name="documentoFiscal"
                  value={form.documentoFiscal}
                  onChange={handleChange}
                  onBlur={() => buscarClientePorDocumento()}
                  className={INPUT}
                  placeholder="12345678Z / B12345678"
                  required
                />
              </InputWrapper>

              {antes("documentoFiscal")}
            </Field>

            {/* POLIZA */}

            <Field label="Número de póliza" required>
              <InputWrapper icon={FileText}>
                <input
                  name="numeroPoliza"
                  value={form.numeroPoliza}
                  onChange={handleChange}
                  className={INPUT}
                  required
                />
              </InputWrapper>
              {antes("numeroPoliza")}
            </Field>

            {/* TOMADOR */}

            <Field label="Tomador" required>
              <InputWrapper icon={User}>
                <input
                  name="tomador"
                  value={form.tomador}
                  onChange={handleChange}
                  className={INPUT}
                  required
                />
              </InputWrapper>
              {antes("tomador")}
            </Field>

            {/* RAMO */}

            <Field label="Ramo" required>
              <InputWrapper icon={Layers}>
                <input
                  list="ramos-list"
                  name="ramo"
                  value={form.ramo}
                  onChange={handleChange}
                  className={INPUT}
                  placeholder="Escribe o selecciona ramo"
                  required
                />

                <datalist id="ramos-list">
                  {ramosDisponibles.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </InputWrapper>
              {antes("ramo")}
            </Field>

            {/* PRIMA */}

            <Field label="Prima neta (€)" required>
              <InputWrapper icon={Euro}>
                <input
                  type="number"
                  step="0.01"
                  name="primaNeta"
                  value={form.primaNeta}
                  onChange={handleChange}
                  className={INPUT}
                  required
                />
              </InputWrapper>
              {antes("primaNeta", (v) => `${v ?? "-"} €`)}
            </Field>

            {/* FORMA PAGO */}

            <Field label="Forma de pago" required>
              <InputWrapper icon={CreditCard}>
                <select
                  name="formaPago"
                  value={form.formaPago}
                  onChange={handleChange}
                  className={`${INPUT} cursor-pointer`}
                  required
                >
                  <option value="">Selecciona forma de pago</option>
                  <option value="Anual">Anual</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Mensual">Mensual</option>
                </select>
              </InputWrapper>
            </Field>

            {/* ACTIVIDAD */}

            <Field label="Actividad" required>
              <InputWrapper icon={Tag}>
                <select
                  name="actividad"
                  value={form.actividad}
                  onChange={handleChange}
                  className={`${INPUT} cursor-pointer`}
                  required
                >
                  <option value="">Selecciona actividad</option>
                  <option value="RECOMENDADO">RECOMENDADO</option>
                  <option value="SGC">SGC</option>
                  <option value="OFICINA">OFICINA</option>
                  <option value="TELEFONICO">TELEFONICO</option>
                  <option value="RED PERSONAL">RED PERSONAL</option>

                  {/* Un empleado que abre una venta con actividad exclusiva del admin
                      ve su valor actual para que no aparezca vacío. */}
                  {actividadExclusivaActual && (
                    <option value={form.actividad}>
                      {form.actividad === "FINCAS" ? "ADMINISTRADOR DE FINCAS" : form.actividad}
                    </option>
                  )}

                  {/* EXCLUSIVO ADMIN */}
                  {isAdmin && (
                    <>
                      <option value="INTERNET">INTERNET</option>
                      <option value="FINCAS">ADMINISTRADOR DE FINCAS</option>
                      <option value="COLABORADORES">COLABORADORES</option>
                    </>
                  )}
                </select>
              </InputWrapper>
            </Field>

            {/* VENTA HISTÓRICA (modal: junto a Actividad) */}
            {modal && campoHistorica}

            {/* OBSERVACIONES */}

            <Field
              label="Observaciones"
              className={
                modal
                  ? conDatos && isAdmin
                    ? "md:col-span-2 lg:col-span-2"
                    : "md:col-span-2 lg:col-span-3"
                  : ""
              }
            >
              <InputWrapper icon={FileText} alignTop>
                <textarea
                  ref={observacionesRef}
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  rows={modal ? 2 : 3}
                  placeholder="Añade aquí cualquier observación relevante..."
                  className={`${INPUT} resize-none overflow-hidden`}
                />
              </InputWrapper>
            </Field>

          </fieldset>

          {/* DATOS DE LA ANULACIÓN (anular: se rellenan · rehabilitar: la anulación original) */}

          {(esAnular || esRehabilitar) && (
            <fieldset
              disabled={esRevision || esRehabilitar || guardando}
              className="min-w-0 border-t border-amber-200/70 bg-amber-50/60 p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-amber-800">
                <Ban size={16} />
                {esRehabilitar ? "Anulación original" : "Datos de la anulación"}

                {(esRevision || esRehabilitar) && venta?.solicitadoPor?.nombre && (
                  <span className="ml-auto text-xs font-medium text-slate-500">
                    Solicitado por{" "}
                    <strong className="text-slate-700">{venta.solicitadoPor.nombre}</strong>
                  </span>
                )}
              </div>

              {esRehabilitar && sinDatosAnulacion && (
                <p className="mb-3 text-xs text-slate-500">
                  No hay datos de la anulación guardados para esta venta.
                </p>
              )}

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">

                <Field label="Fecha de anulación" required={!esRehabilitar}>
                  <div className="grid h-11 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1">
                    {(
                      [
                        ["VENCIMIENTO", "Vencimiento"],
                        ["FECHA", "A fecha"],
                      ] as const
                    ).map(([valor, texto]) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => {
                          setFechaTipo(valor);
                          if (valor === "VENCIMIENTO") setFechaAnulacion("");
                        }}
                        className={`rounded-lg text-sm font-semibold transition cursor-pointer disabled:cursor-default ${
                          fechaTipo === valor
                            ? "bg-[#eaeffc] text-[#2f5bd3]"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Fecha concreta" required={!esRehabilitar && fechaTipo === "FECHA"}>
                  <InputWrapper icon={Calendar}>
                    <input
                      type="date"
                      value={fechaAnulacion}
                      onChange={(e) => setFechaAnulacion(e.target.value)}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      disabled={fechaTipo !== "FECHA" || esRevision || esRehabilitar || guardando}
                      className={`${INPUT} cursor-pointer disabled:opacity-60`}
                    />
                  </InputWrapper>
                </Field>

                <Field label="Derivado a Verti">
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={derivadoVerti}
                      onClick={() => setDerivadoVerti((v) => !v)}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-default ${
                        derivadoVerti ? "bg-[#2f5bd3]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          derivadoVerti ? "translate-x-5" : ""
                        }`}
                      />
                    </button>

                    <span className="text-sm text-slate-600">{derivadoVerti ? "Sí" : "No"}</span>
                  </div>
                </Field>

                <Field label="Motivo" required={!esRehabilitar} className="md:col-span-2 lg:col-span-3">
                  <InputWrapper icon={FileText} alignTop>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={2}
                      placeholder="Describe el motivo…"
                      className={`${INPUT} resize-none`}
                    />
                  </InputWrapper>
                </Field>

              </div>
            </fieldset>
          )}

          {/* ERROR */}

          {(error || errorEstado) && (
            <div className="px-5 pb-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-semibold">
                {error || errorEstado}
              </div>
            </div>
          )}

          {/* PIE */}

          {(pieIzquierda || pieDerecha) && (
            <div className="border-t border-slate-200/70 bg-[#f5f7fc] px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-3">{pieIzquierda}</div>
              <div className="flex flex-wrap justify-end gap-3">{pieDerecha}</div>
            </div>
          )}

        </form>
        )}
    </div>
  );

  return (
    <>
      {modal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
          {/* Pulsar fuera cierra; si el clic empieza dentro (arrastrar para
              seleccionar texto) y acaba fuera, no. */}
          <div
            className="flex min-h-full items-center justify-center p-3 sm:p-6"
            onMouseDown={(e) => {
              pulsoEnFondo.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
              if (pulsoEnFondo.current && e.target === e.currentTarget && !guardando) {
                onClose?.();
              }
              pulsoEnFondo.current = false;
            }}
          >
            {contenido}
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-[#f1f3f8] px-5 py-6">{contenido}</div>
      )}

      {/* =====================================================
          MODAL ÉXITO
      ===================================================== */}

      {showSuccess && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">

          <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl">

            <div className="flex items-center gap-3 mb-3">

              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">

                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-600"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>

              </div>

              <h2 className="text-lg font-semibold text-slate-800">
                Venta guardada correctamente
              </h2>

            </div>

            <p className="text-slate-600">
              La venta se ha registrado en el libro de ventas.
            </p>

            <div className="flex justify-end mt-6">

              <button
                type="button"
                onClick={() => {
                  setShowSuccess(
                    false
                  );

                  navigate("/crm/libro-ventas");
                }}
                className="px-6 py-2.5 bg-[#2f5bd3] text-white shadow-[0_10px_22px_-10px_rgba(47,91,211,0.7)] rounded-xl font-semibold hover:bg-[#2548b3]"
              >
                OK
              </button>

            </div>

          </div>

        </div>
      )}

      {showInfo && (
        <InfoModal
          type={isDelete || esEliminar ? "delete" : "edit"}
          onClose={() => {
            setShowInfo(false);
            if (esEliminar) onSaved?.(); // solo refrescar: es una solicitud, no un borrado
            onClose?.();
          }}
        />
      )}
    </>
  );
};

/* =========================================================
   CAMPO
========================================================= */

const Field = ({
  label,
  required = false,
  className = "",
  extra,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  /** Texto pequeño a la derecha de la etiqueta (no añade altura). */
  extra?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>

    <div className="flex items-baseline justify-between gap-2">

      <label className="text-sm font-semibold tracking-tight text-slate-700">
        {label}

        {required && (
          <span className="text-[#2f5bd3] ml-1">
            *
          </span>
        )}
      </label>

      {extra}

    </div>

    {children}

  </div>
);

/* =========================================================
   INPUT CON ICONO
========================================================= */

const InputWrapper = ({
  icon: Icon,
  alignTop = false,
  children,
}: {
  icon: LucideIcon;
  alignTop?: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={`flex border border-slate-200 rounded-xl bg-white overflow-hidden transition focus-within:border-[#2f5bd3] focus-within:ring-4 focus-within:ring-[#2f5bd3]/15 ${
      alignTop ? "items-stretch" : "items-center"
    }`}
  >

    <div
      className={`w-12 flex justify-center border-r border-slate-200 bg-[#f5f7fc] text-[#2f5bd3] shrink-0 ${
        alignTop ? "items-start pt-3" : "h-11 items-center"
      }`}
    >
      <Icon size={18} strokeWidth={1.8} />
    </div>

    <div className="flex-1 min-w-0">
      {children}
    </div>

  </div>
);

/* =========================================================
   DATO DEL ANÁLISIS
========================================================= */

const AnalisisDato = ({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) => (
  <div className="flex items-center justify-between gap-3 bg-white border border-slate-200/70 rounded-xl px-3 py-2.5">

    <div className="flex items-center gap-2 min-w-0">

      <span className="text-[#2f5bd3] shrink-0">

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>

      </span>

      <span className="text-sm text-slate-500 truncate">
        {label}
      </span>

    </div>

    <div className="flex items-center gap-2 min-w-0">

      <span className="font-semibold text-sm text-slate-800 truncate">
        {value || "No detectado"}
      </span>

      <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">

        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-600"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>

      </span>

    </div>

  </div>
);

export default NuevaVenta;