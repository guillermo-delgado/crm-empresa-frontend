/**
 * Utilidades de fecha para horario laboral (zona horaria de España).
 *
 * REGLAS (para que nunca vuelva a fallar):
 *  1. "Hoy" siempre se calcula en Europe/Madrid, nunca con toISOString()
 *     (que es UTC y entre las 00:00 y las 02:00 devuelve el día anterior).
 *  2. Las fechas "YYYY-MM-DD" NUNCA se pasan a new Date("YYYY-MM-DD")
 *     (se interpretan como UTC y pueden desplazar el día). Se trabaja con
 *     el texto o con Date.UTC() y getUTC*(), que no dependen de la zona
 *     horaria del navegador ni del horario de verano.
 *  3. Las horas de los fichajes ("HH:mm") se tratan como texto de reloj.
 *
 * Ubicación sugerida: src/utils/fechasES.ts
 */

export const ZONA_ES = "Europe/Madrid";

const formatoMadrid = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_ES,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en España: "YYYY-MM-DD". */
export function hoyISO(ahora: Date = new Date()): string {
  const partes = formatoMadrid.formatToParts(ahora);
  const y = partes.find((p) => p.type === "year")?.value;
  const m = partes.find((p) => p.type === "month")?.value;
  const d = partes.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** Mes actual en España: "YYYY-MM". */
export function mesActualISO(): string {
  return hoyISO().slice(0, 7);
}

/** Descompone "YYYY-MM-DD" (o "YYYY-MM-DDTHH:mm...") sin usar Date. */
export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function aUtc(iso: string): Date {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function deUtc(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado */
export function diaSemanaIdx(iso: string): number {
  return aUtc(iso).getUTCDay();
}

export function esFinDeSemana(iso: string): boolean {
  const dia = diaSemanaIdx(iso);
  return dia === 0 || dia === 6;
}

export function addDias(iso: string, dias: number): string {
  const fecha = aUtc(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return deUtc(fecha);
}

/** Lunes de la semana a la que pertenece la fecha. */
export function lunesDe(iso: string): string {
  const desdeLunes = (diaSemanaIdx(iso) + 6) % 7;
  return addDias(iso, -desdeLunes);
}

/** mes1 = 1..12 */
export function ultimoDiaDelMes(year: number, mes1: number): number {
  return new Date(Date.UTC(year, mes1, 0)).getUTCDate();
}

export function diasDelMes(year: number, mes1: number): number[] {
  return Array.from({ length: ultimoDiaDelMes(year, mes1) }, (_, i) => i + 1);
}

/** Huecos antes del día 1 con la semana empezando en lunes. */
export function huecosIniciales(year: number, mes1: number): number {
  return (new Date(Date.UTC(year, mes1 - 1, 1)).getUTCDay() + 6) % 7;
}

export function claveFecha(year: number, mes1: number, dia: number): string {
  return `${year}-${String(mes1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function claveMes(year: number, mes1: number): string {
  return `${year}-${String(mes1).padStart(2, "0")}`;
}

/** "03/10/2026" */
export function formatFechaES(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "octubre de 2026" */
export function etiquetaMes(year: number, mes1: number): string {
  return new Date(Date.UTC(year, mes1 - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "sábado" */
export function nombreDia(iso: string): string {
  return aUtc(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** "sáb" */
export function nombreDiaCorto(iso: string): string {
  return aUtc(iso)
    .toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" })
    .replace(".", "");
}

/** Suma meses a "YYYY-MM". */
export function sumarMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** ¿El mes "YYYY-MM" es posterior al mes actual en España? */
export function esMesFuturo(mes: string): boolean {
  return mes > mesActualISO();
}

/** "2 h 05 min" */
export function minutosAHoras(min: number): string {
  const total = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} min`;
}

/** Minutos entre dos horas "HH:mm" del mismo día (null si no es válido). */
export function minutosEntre(entrada: string, salida: string): number | null {
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return null;
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff >= 0 ? diff : null;
}

/** "09:05" o "9:05" → minutos desde las 00:00 */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

const formatoHoraMadrid = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA_ES,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} as Intl.DateTimeFormatOptions);

/** Hora actual de España: { hora: "HH:mm", minutos: minutos desde 00:00 } */
export function horaEspana(ahora: Date = new Date()): {
  hora: string;
  minutos: number;
} {
  const partes = formatoHoraMadrid.formatToParts(ahora);
  const hh = partes.find((p) => p.type === "hour")?.value ?? "00";
  const mm = partes.find((p) => p.type === "minute")?.value ?? "00";
  const hora = `${hh === "24" ? "00" : hh}:${mm}`;

  return { hora, minutos: horaAMinutos(hora) };
}