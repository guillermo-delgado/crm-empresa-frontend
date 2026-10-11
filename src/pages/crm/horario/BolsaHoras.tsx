import { useCallback, useEffect, useState } from "react";
import api from "../../../services/api";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { formatFechaES, minutosAHoras } from "../../../utils/fechasES";

/* =======================
   TIPOS
======================= */
type TipoAjuste = "DESCANSO" | "NOMINA" | "REGULARIZACION";

type Ajuste = {
  id: string;
  fecha: string;
  tipo: TipoAjuste;
  minutos: number;
  comentario: string;
};

type Saldo = {
  saldoMinutos: number; // acumulado total hasta hoy
  desde: string | null;
  hasta: string;
  mes: string;
  esMesActual: boolean;
  esMesFuturo: boolean;
  aperturaMinutos: number; // lo que traía de meses anteriores
  mesMinutos: number; // neto de los días del mes
  ajustesMesMinutos: number;
  cierreMinutos: number; // apertura + mes + ajustes
  confirmadoMinutos: number; // pendiente real y pagable
  ajustes: Ajuste[];
};

const ETIQUETA: Record<TipoAjuste, string> = {
  DESCANSO: "Compensadas con descanso",
  NOMINA: "Pagadas en nómina",
  REGULARIZACION: "Regularización",
};

const conSigno = (min: number) =>
  min === 0 ? "0 h 00 min" : `${min > 0 ? "+" : "-"}${minutosAHoras(Math.abs(min))}`;

const nombreMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    timeZone: "UTC",
  });
};

const hoyLocal = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/* =======================
   COMPONENTE
   Tarjeta "Bolsa de horas" del empleado seleccionado en el CRM.
   Cómputo mensual: cada mes cerrado aporta su balance (trabajadas − contrato)
   y se arrastra al siguiente. El mes en curso es provisional: se muestra pero
   no se arrastra ni se paga hasta que termina. Se puede pagar o devolver desde
   cualquier mes; el ajuste cae dentro de ese mes.
======================= */
export default function BolsaHoras({
  empleadoId,
  mes,
}: {
  empleadoId: string;
  mes: string;
}) {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [verLista, setVerLista] = useState(false);
  const [liquidando, setLiquidando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Saldo>("/crm/horario/saldo", {
        params: { empleadoId, mes },
      });
      setSaldo(res.data);
    } catch {
      setSaldo(null);
      setError("No se ha podido cargar la bolsa de horas.");
    } finally {
      setLoading(false);
    }
  }, [empleadoId, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const eliminar = async (id: string) => {
    if (!window.confirm("¿Eliminar este ajuste?")) return;
    try {
      await api.delete(`/crm/horario/saldo/ajustes/${id}`);
      await cargar();
    } catch {
      setError("No se ha podido eliminar el ajuste.");
    }
  };

  const liquidar = async (tipo?: "NOMINA" | "DESCANSO") => {
    if (!saldo) return;
    const mesTxt = nombreMes(mes);
    const pendiente = saldo.confirmadoMinutos;
    const texto =
      pendiente > 0
        ? `Se dejarán a 0 las ${minutosAHoras(pendiente)} pendientes ${
            saldo.esMesActual ? "de meses cerrados" : `hasta ${mesTxt}`
          } (${
            tipo === "NOMINA" ? "pagadas en nómina" : "devueltas con descanso"
          }). El ajuste quedará fechado ${
            saldo.esMesActual ? "hoy" : `en ${mesTxt}`
          }. ¿Continuar?`
        : `Se darán por saldadas las ${minutosAHoras(
            Math.abs(pendiente)
          )} que debe el empleado ${
            saldo.esMesActual ? "de meses cerrados" : `hasta ${mesTxt}`
          }. ¿Continuar?`;
    if (!window.confirm(texto)) return;

    setLiquidando(true);
    setError("");
    try {
      await api.post("/crm/horario/saldo/liquidar", { empleadoId, mes, tipo });
      await cargar();
      setVerLista(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "No se ha podido liquidar.");
    } finally {
      setLiquidando(false);
    }
  };

  const valor = !saldo || saldo.esMesFuturo ? 0 : saldo.confirmadoMinutos;
  const ajustesDelMes = (saldo?.ajustes ?? []).filter(
    (a) => a.fecha.slice(0, 7) === mes
  );
  // Fecha por defecto de un ajuste manual dentro del mes consultado
  const fechaDefecto =
    saldo && !saldo.esMesActual && !saldo.esMesFuturo
      ? new Date(
          Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)
        )
          .toISOString()
          .slice(0, 10)
      : hoyLocal();

  const tono =
    !saldo || valor === 0
      ? "text-slate-900"
      : valor > 0
      ? "text-emerald-600"
      : "text-red-600";

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Bolsa de horas · <span className="capitalize">{nombreMes(mes)}</span>
          </div>

          {loading ? (
            <Loader2 className="mt-2 animate-spin text-[#2f5bd3]" size={22} />
          ) : saldo ? (
            saldo.esMesFuturo ? (
              <div className="mt-1 text-sm text-slate-500">
                Este mes aún no ha empezado.
              </div>
            ) : (
              <>
                <div className={`text-2xl font-bold ${tono}`}>
                  {conSigno(valor)}
                </div>

                <div className="text-xs text-slate-500">
                  Arrastre {conSigno(saldo.aperturaMinutos)} · Este mes{" "}
                  {conSigno(saldo.mesMinutos)} · Ajustes{" "}
                  {conSigno(saldo.ajustesMesMinutos)}
                </div>

                {saldo.esMesActual && (
                  <div className="mt-1 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    Mes en curso: {conSigno(saldo.mesMinutos)} provisional · se
                    suma al cerrar el mes
                  </div>
                )}
              </>
            )
          ) : (
            <div className="text-sm text-red-600">{error}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saldo && ajustesDelMes.length > 0 && (
            <button
              type="button"
              onClick={() => setVerLista((v) => !v)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              {verLista ? "Ocultar ajustes" : `Ver ajustes (${ajustesDelMes.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            disabled={!saldo}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#2f5bd3] px-4 py-2 text-sm font-medium text-white hover:bg-[#2548b3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} /> Ajustar
          </button>
        </div>
      </div>

      {/* LIQUIDAR: dejar a 0 lo pendiente hasta el mes consultado */}
      {saldo && !saldo.esMesFuturo && saldo.confirmadoMinutos !== 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#f5f7fc] px-4 py-3">
          <span className="mr-auto text-sm text-slate-600">
            {saldo.esMesActual ? (
              "Pendiente de meses cerrados: "
            ) : (
              <>
                Pendiente hasta{" "}
                <span className="capitalize">{nombreMes(mes)}</span>:{" "}
              </>
            )}
            <b className={saldo.confirmadoMinutos > 0 ? "text-emerald-600" : "text-red-600"}>
              {conSigno(saldo.confirmadoMinutos)}
            </b>
          </span>

          {saldo.confirmadoMinutos > 0 ? (
            <>
              <button
                type="button"
                disabled={liquidando}
                onClick={() => liquidar("NOMINA")}
                className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Pagadas en nómina
              </button>
              <button
                type="button"
                disabled={liquidando}
                onClick={() => liquidar("DESCANSO")}
                className="cursor-pointer rounded-xl border border-emerald-600 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                Devueltas con descanso
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={liquidando}
              onClick={() => liquidar()}
              className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Dar por saldado
            </button>
          )}
        </div>
      )}

      {error && saldo && <p className="text-sm text-red-600">{error}</p>}

      {verLista && saldo && ajustesDelMes.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70">
          {ajustesDelMes.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">
                  {ETIQUETA[a.tipo]}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {formatFechaES(a.fecha)}
                  {a.comentario ? ` · ${a.comentario}` : ""}
                </div>
              </div>
              <span
                className={`font-bold ${
                  a.minutos < 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {conSigno(a.minutos)}
              </span>
              <button
                type="button"
                onClick={() => eliminar(a.id)}
                aria-label="Eliminar ajuste"
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <ModalAjuste
          empleadoId={empleadoId}
          fechaInicial={fechaDefecto}
          onClose={() => setAbierto(false)}
          onGuardado={async () => {
            setAbierto(false);
            setVerLista(true);
            await cargar();
          }}
        />
      )}
    </div>
  );
}

/* =======================
   MODAL
======================= */
function ModalAjuste({
  empleadoId,
  fechaInicial,
  onClose,
  onGuardado,
}: {
  empleadoId: string;
  fechaInicial: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState<TipoAjuste>("DESCANSO");
  const [signo, setSigno] = useState<1 | -1>(1); // solo regularización
  const [horas, setHoras] = useState("");
  const [minutos, setMinutos] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const total = (Number(horas) || 0) * 60 + (Number(minutos) || 0);

  const guardar = async () => {
    setError("");
    if (total <= 0) return setError("Indica las horas del ajuste.");
    if (tipo === "REGULARIZACION" && !comentario.trim()) {
      return setError("La regularización necesita un comentario.");
    }

    setGuardando(true);
    try {
      await api.post("/crm/horario/saldo/ajustes", {
        empleadoId,
        tipo,
        minutos: tipo === "REGULARIZACION" ? signo * total : total,
        fecha,
        comentario: comentario.trim(),
      });
      onGuardado();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "No se ha podido guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const campo =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2f5bd3]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-[460px] max-w-full space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Ajustar bolsa de horas</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <label className="block space-y-1 text-sm font-medium text-slate-700">
          Tipo
          <select
            className={campo}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoAjuste)}
          >
            <option value="DESCANSO">Compensadas con descanso (resta)</option>
            <option value="NOMINA">Pagadas en nómina (resta)</option>
            <option value="REGULARIZACION">Regularización (suma o resta)</option>
          </select>
        </label>

        {tipo === "REGULARIZACION" && (
          <div className="flex gap-2">
            {([1, -1] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSigno(s)}
                className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold ${
                  signo === s
                    ? "border-[#2f5bd3] bg-[#e3eafb] text-[#2f5bd3]"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {s === 1 ? "Suma a favor del empleado" : "Resta"}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Horas
            <input
              type="number"
              min={0}
              className={campo}
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Minutos
            <input
              type="number"
              min={0}
              max={59}
              className={campo}
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Fecha
            <input
              type="date"
              className={campo}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm font-medium text-slate-700">
          Comentario{tipo === "REGULARIZACION" ? " (obligatorio)" : " (opcional)"}
          <input
            className={campo}
            maxLength={200}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={
              tipo === "DESCANSO"
                ? "Ej: día libre 15/08"
                : tipo === "NOMINA"
                ? "Ej: pagadas en nómina de septiembre"
                : "Motivo de la corrección"
            }
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="cursor-pointer rounded-xl bg-[#2f5bd3] px-4 py-2 text-sm font-medium text-white hover:bg-[#2548b3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}