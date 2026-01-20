export type Fichaje = {
  _id: string;
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
};

export type RegistroHorario = {
  _id: string;
  fecha: string;
  fichajes: Fichaje[];
  minutosTrabajados: number;
};

export type DiaCalendario = {
  fecha: string;
  horas: string;
  fichajes: Fichaje[];
};
