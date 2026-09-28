import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

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

const NuevaVenta = () => {
  const navigate = useNavigate();

  const dateRef = useRef<HTMLInputElement>(null);
  const polizaInputRef = useRef<HTMLInputElement>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [form, setForm] = useState({
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
    createdBy: "",
    createdAt: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

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

  /* =========================================================
     BUSCAR CLIENTE POR NIF
     ========================================================= */

  const buscarClientePorDocumento = async (
    documento?: string
  ) => {
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
    setForm({
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
      createdBy: "",
      createdAt: "",
    });

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
     GUARDAR VENTA
     ========================================================= */

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError(null);

    try {
      // La póliza analizada nunca se adjunta a la venta.
      const formData =
        new FormData();

      formData.append(
        "fechaEfecto",
        form.fechaEfecto
      );

      formData.append(
        "aseguradora",
        form.aseguradora
      );

      formData.append(
        "ramo",
        form.ramo
      );

      formData.append(
        "numeroPoliza",
        form.numeroPoliza
      );

      formData.append(
        "documentoFiscal",
        form.documentoFiscal
      );

      formData.append(
        "tomador",
        form.tomador
      );

      formData.append(
        "primaNeta",
        String(
          Number(form.primaNeta)
        )
      );

      formData.append(
        "formaPago",
        form.formaPago
      );

      formData.append(
        "actividad",
        form.actividad
      );

      formData.append(
        "observaciones",
        form.observaciones
      );

      /* =========================
         USUARIO ASIGNADO
      ========================= */

      if (
        isAdmin &&
        form.createdBy
      ) {
        formData.append(
          "createdBy",
          form.createdBy
        );
      }

      /* =========================
         VENTA HISTÓRICA
      ========================= */

      if (
        isAdmin &&
        ventaHistorica &&
        form.createdAt
      ) {
        formData.append(
          "createdAt",
          form.createdAt
        );
      }

      await api.post(
        "/ventas",
        formData
      );

      setShowSuccess(true);
    } catch (err: any) {
      console.error(
        "ERROR GUARDANDO VENTA:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Error inesperado al guardar la venta"
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="max-w-7xl mx-auto">

        {/* =====================================================
            CABECERA
        ===================================================== */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-6">

          <div className="flex items-center gap-4">

            <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center shadow-sm">

              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line
                  x1="12"
                  y1="11"
                  x2="12"
                  y2="17"
                />
                <line
                  x1="9"
                  y1="14"
                  x2="15"
                  y2="14"
                />
              </svg>

            </div>

            <div>

              <h1 className="text-3xl font-bold text-slate-800">
                Nueva venta
              </h1>

              <p className="text-slate-500 mt-1">
                Registra una nueva póliza en el sistema
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/crm/libro-ventas"
              )
            }
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold shadow-sm hover:bg-slate-50 cursor-pointer"
          >
            <span className="text-xl">
              ←
            </span>

            Volver al libro de ventas
          </button>

        </div>

        {/* =====================================================
            BLOQUE PÓLIZA
        ===================================================== */}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
              className={`min-h-[250px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-6 transition-all cursor-pointer ${
                dragActive
                  ? "border-slate-700 bg-slate-100"
                  : "border-slate-300 bg-slate-50 hover:border-slate-500 hover:bg-slate-100"
              }`}
            >

              <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center mb-4">

                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-700"
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
                className="mt-5 px-7 py-3 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

              {!polizaAnalizada ? (

                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center">

                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-3">

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
                    <div className="mt-4 px-4 py-3 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium">
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

          </div>

        </div>

        {/* =====================================================
            FORMULARIO
        ===================================================== */}

        <form
          onSubmit={
            handleSubmit
          }
          className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
        >

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

            {/* FECHA */}

            <Field
              label="Fecha de efecto"
              required
            >
              <InputWrapper icon="calendar">

                <input
                  ref={dateRef}
                  type="date"
                  name="fechaEfecto"
                  value={
                    form.fechaEfecto
                  }
                  onChange={
                    handleChange
                  }
                  onClick={() =>
                    dateRef.current?.showPicker()
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0"
                  required
                />

              </InputWrapper>
            </Field>

            {/* VENTA HISTÓRICA */}

            {isAdmin ? (
              <div className="flex items-center h-full pt-7">

                <button
                  type="button"
                  onClick={() =>
                    setVentaHistorica(
                      (v) => !v
                    )
                  }
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    ventaHistorica
                      ? "bg-slate-800"
                      : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      ventaHistorica
                        ? "translate-x-5"
                        : ""
                    }`}
                  />
                </button>

                <div className="ml-3">

                  <p className="text-sm font-semibold text-slate-800">
                    Venta histórica
                  </p>

                  <p className="text-xs text-slate-500">
                    Solo para ventas anteriores a la fecha actual
                  </p>

                </div>

              </div>
            ) : (
              <div />
            )}

            {/* FECHA CREACIÓN */}

            {isAdmin &&
              ventaHistorica && (
                <Field
                  label="Fecha de creación (venta histórica)"
                >
                  <InputWrapper icon="calendar">

                    <input
                      type="date"
                      name="createdAt"
                      value={
                        form.createdAt
                      }
                      onChange={
                        handleChange
                      }
                      className="input border-0 shadow-none rounded-none w-full pl-0"
                    />

                  </InputWrapper>
                </Field>
              )}

            {/* USUARIO */}

            {isAdmin && (
              <Field label="Usuario">

                <InputWrapper icon="user">

                  <input
                    list="usuarios-list"
                    name="createdBy"
                    value={
                      form.createdBy
                    }
                    onChange={
                      handleChange
                    }
                    className="input border-0 shadow-none rounded-none w-full pl-0"
                    placeholder="Escribe para buscar usuario"
                  />

                  <datalist id="usuarios-list">
                    {usuarios.map(
                      (u) => (
                        <option
                          key={u._id}
                          value={
                            u.numma ||
                            u.nombre ||
                            u.email
                          }
                        >
                          {u.nombre} (
                          {u.email})
                        </option>
                      )
                    )}
                  </datalist>

                </InputWrapper>

              </Field>
            )}

            {/* ASEGURADORA */}

            <Field
              label="Aseguradora"
              required
            >
              <InputWrapper icon="shield">

                <select
                  name="aseguradora"
                  value={
                    form.aseguradora
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0 cursor-pointer"
                  required
                >
                  <option value="">
                    Selecciona aseguradora
                  </option>

                  <option value="Mapfre">
                    Mapfre
                  </option>

                  <option value="Verti">
                    Verti
                  </option>
                </select>

              </InputWrapper>
            </Field>

            {/* NIF + BUSCADOR */}

            <Field
              label="N.I.F / N.I.E / C.I.F"
              required
            >

              <InputWrapper icon="card">

                <input
                  name="documentoFiscal"
                  value={
                    form.documentoFiscal
                  }
                  onChange={
                    handleChange
                  }
                  onBlur={() =>
                    buscarClientePorDocumento()
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0"
                  placeholder="12345678Z / B12345678"
                  required
                />

              </InputWrapper>

              <div className="min-h-[20px]">

                {buscandoCliente && (
                  <p className="text-xs text-slate-500 flex items-center gap-2">

                    <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />

                    Buscando cliente...
                  </p>
                )}

                {!buscandoCliente &&
                  clienteEncontrado && (
                    <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
                      ✓ Cliente encontrado. Se ha cargado el tomador.
                    </p>
                  )}

                {!buscandoCliente &&
                  clienteNoEncontrado && (
                    <p className="text-xs text-slate-500">
                      No existe un cliente registrado con este documento.
                    </p>
                  )}

              </div>

            </Field>

            {/* POLIZA */}

            <Field
              label="Número de póliza"
              required
            >
              <InputWrapper icon="file">

                <input
                  name="numeroPoliza"
                  value={
                    form.numeroPoliza
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0"
                  required
                />

              </InputWrapper>
            </Field>

            {/* TOMADOR */}

            <Field
              label="Tomador"
              required
            >
              <InputWrapper icon="user">

                <input
                  name="tomador"
                  value={
                    form.tomador
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0"
                  required
                />

              </InputWrapper>
            </Field>

            {/* RAMO */}

            <Field
              label="Ramo"
              required
            >
              <InputWrapper icon="layers">

                <input
                  list="ramos-list"
                  name="ramo"
                  value={
                    form.ramo
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0"
                  placeholder="Escribe o selecciona ramo"
                  required
                />

                <datalist id="ramos-list">
                  {ramosDisponibles.map(
                    (r) => (
                      <option
                        key={r}
                        value={r}
                      />
                    )
                  )}
                </datalist>

              </InputWrapper>
            </Field>

            {/* PRIMA */}

            <Field
              label="Prima neta (€)"
              required
            >
              <InputWrapper icon="euro">

                <input
                  type="number"
                  step="0.01"
                  name="primaNeta"
                  value={
                    form.primaNeta
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0"
                  required
                />

              </InputWrapper>
            </Field>

            {/* FORMA PAGO */}

            <Field
              label="Forma de pago"
              required
            >
              <InputWrapper icon="card">

                <select
                  name="formaPago"
                  value={
                    form.formaPago
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0 cursor-pointer"
                  required
                >
                  <option value="">
                    Selecciona forma de pago
                  </option>

                  <option value="Anual">
                    Anual
                  </option>

                  <option value="Semestral">
                    Semestral
                  </option>

                  <option value="Trimestral">
                    Trimestral
                  </option>

                  <option value="Mensual">
                    Mensual
                  </option>
                </select>

              </InputWrapper>
            </Field>

            {/* ACTIVIDAD */}

            <Field label="Actividad">

              <InputWrapper icon="tag">

                <select
                  name="actividad"
                  value={
                    form.actividad
                  }
                  onChange={
                    handleChange
                  }
                  className="input border-0 shadow-none rounded-none w-full pl-0 cursor-pointer"
                  required
                >
                  <option value="">
                    Selecciona actividad
                  </option>

                  <option value="RECOMENDADO">
                    RECOMENDADO
                  </option>

                  <option value="SGC">
                    SGC
                  </option>

                  <option value="OFICINA">
                    OFICINA
                  </option>

                  <option value="TELEFONICO">
                    TELEFONICO
                  </option>

                  <option value="INTERNET">
                    INTERNET
                  </option>

                  <option value="RED PERSONAL">
                    RED PERSONAL
                  </option>

                  {isAdmin && (
                    <>
                      <option value="FINCAS">
                        ADMINISTRADOR DE FINCAS
                      </option>

                      <option value="COLABORADORES">
                        COLABORADORES
                      </option>
                    </>
                  )}
                </select>

              </InputWrapper>

            </Field>

            {/* OBSERVACIONES */}

            <Field label="Observaciones">

              <div className="flex items-start border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-slate-500">

                <div className="w-12 min-h-[76px] flex items-center justify-center border-r border-slate-200 text-slate-500 shrink-0">

                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line
                      x1="8"
                      y1="13"
                      x2="16"
                      y2="13"
                    />
                    <line
                      x1="8"
                      y1="17"
                      x2="14"
                      y2="17"
                    />
                  </svg>

                </div>

                <textarea
                  name="observaciones"
                  value={
                    form.observaciones
                  }
                  onChange={(e) => {
                    setForm({
                      ...form,
                      observaciones:
                        e.target.value,
                    });

                    e.target.style.height =
                      "auto";

                    e.target.style.height =
                      e.target.scrollHeight +
                      "px";
                  }}
                  rows={3}
                  placeholder="Añade aquí cualquier observación relevante..."
                  className="w-full min-h-[76px] px-4 py-3 outline-none resize-none text-sm text-slate-700 placeholder:text-slate-400"
                />

              </div>

            </Field>

          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="px-6 pb-5">

              <div className="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-3 rounded-lg font-semibold">
                {error}
              </div>

            </div>
          )}

          {/* =================================================
              PIE
          ================================================= */}

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <button
              type="button"
              onClick={
                limpiarFormulario
              }
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-9.5L1 10" />
              </svg>

              Limpiar formulario
            </button>

            <button
              type="submit"
              disabled={
                showSuccess ||
                analizandoPoliza
              }
              className="flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>

              Guardar venta
            </button>

          </div>

        </form>
      </div>

      {/* =====================================================
          MODAL ÉXITO
      ===================================================== */}

      {showSuccess && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4">

          <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">

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

                  navigate(
                    "/crm/libro-ventas"
                  );
                }}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700"
              >
                OK
              </button>

            </div>

          </div>

        </div>
      )}
    </div>
  );
};

/* =========================================================
   CAMPO
========================================================= */

const Field = ({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2">

    <label className="text-sm font-semibold text-slate-700">
      {label}

      {required && (
        <span className="text-slate-500 ml-1">
          *
        </span>
      )}
    </label>

    {children}

  </div>
);

/* =========================================================
   INPUT CON ICONO
========================================================= */

const InputWrapper = ({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-200">

    <div className="w-12 h-11 flex items-center justify-center border-r border-slate-200 text-slate-500 shrink-0">
      <FieldIcon type={icon} />
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
  <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5">

    <div className="flex items-center gap-2 min-w-0">

      <span className="text-slate-500 shrink-0">

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

/* =========================================================
   ICONOS
========================================================= */

const FieldIcon = ({
  type,
}: {
  type: string;
}) => {

  if (type === "calendar") {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="17"
          rx="2"
        />
        <line
          x1="16"
          y1="2"
          x2="16"
          y2="6"
        />
        <line
          x1="8"
          y1="2"
          x2="8"
          y2="6"
        />
        <line
          x1="3"
          y1="10"
          x2="21"
          y2="10"
        />
      </svg>
    );
  }

  if (type === "user") {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          cx="12"
          cy="8"
          r="4"
        />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  if (type === "shield") {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
      </svg>
    );
  }

  if (type === "card") {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
        />
        <line
          x1="3"
          y1="10"
          x2="21"
          y2="10"
        />
        <line
          x1="7"
          y1="15"
          x2="11"
          y2="15"
        />
      </svg>
    );
  }

  if (type === "layers") {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 22 7 12 12 2 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
      </svg>
    );
  }

  if (type === "euro") {
    return (
      <span className="text-lg font-semibold">
        €
      </span>
    );
  }

  if (type === "tag") {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41L13.4 20.6a2 2 0 0 1-2.83 0L3.4 13.4a2 2 0 0 1 0-2.83L10.6 3.4A2 2 0 0 1 12 3h6a2 2 0 0 1 2 2v6c0 .53-.21 1.04-.59 1.41z" />
        <circle
          cx="16.5"
          cy="7.5"
          r="1"
        />
      </svg>
    );
  }

  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

export default NuevaVenta;