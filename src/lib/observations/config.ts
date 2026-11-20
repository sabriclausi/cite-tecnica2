export type PeriodAvailability = "available" | "pending";

export interface ObservationConfig {
  /** Cantidad de materias con X para activar recomendación global. */
  globalRecoveryThreshold: number;
  /** Disponibilidad de datos por período. "pending" indica que el período aún no tiene calificaciones cargadas (p.ej. año en curso). */
  periods?: {
    "1C": PeriodAvailability;
    "2C": PeriodAvailability;
  };
  accreditation: {
    /**
     * Decisión institucional pendiente (GUIA sección 24).
     * Mientras sea "descriptive", el texto evita afirmar acreditación final o materia pendiente definitiva.
     */
    mode: "descriptive" | "institutional";
  };
}

export const defaultObservationConfig: ObservationConfig = {
  globalRecoveryThreshold: 3,
  periods: {
    "1C": "available",
    "2C": "available",
  },
  accreditation: {
    mode: "descriptive",
  },
};

export function formatSubjectList(subjects: string[]): string {
  if (subjects.length === 0) return "";
  if (subjects.length === 1) return subjects[0];
  if (subjects.length === 2) return `${subjects[0]} y ${subjects[1]}`;
  return `${subjects.slice(0, -1).join(", ")} y ${subjects[subjects.length - 1]}`;
}

export function periodLabel(period: "1C" | "2C"): string {
  return period === "1C" ? "primer período" : "segundo período";
}

export function periodShort(period: "1C" | "2C"): string {
  return period;
}
