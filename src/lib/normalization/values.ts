import type { GradeValue } from "@/types/academic";

/** Nota mínima de aprobación cuando la planilla usa calificaciones numéricas. */
export const PASSING_GRADE = 6;

const NUMERIC_GRADE_PATTERN = /^[+-]?\d+(?:[.,]\d+)?$/;

/**
 * Normaliza un valor de calificación del Excel.
 * - A/a (con espacios) => 'A'
 * - X/x (con espacios) => 'X'
 * - número o texto numérico => 'A' si es >= 6, 'X' si es < 6 (coma o punto decimal)
 * - vacío/null/undefined => null (información no registrada)
 * - cualquier otro valor => null y se reporta como desconocido externamente
 */
export function normalizeGradeValue(raw: unknown): {
  value: GradeValue;
  isUnknown: boolean;
} {
  if (raw === null || raw === undefined) {
    return { value: null, isUnknown: false };
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { value: null, isUnknown: true };
    return { value: raw >= PASSING_GRADE ? "A" : "X", isUnknown: false };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return { value: null, isUnknown: false };
    }
    const upper = trimmed.toUpperCase();
    if (upper === "A") return { value: "A", isUnknown: false };
    if (upper === "X") return { value: "X", isUnknown: false };
    if (NUMERIC_GRADE_PATTERN.test(trimmed)) {
      const numeric = Number(trimmed.replace(",", "."));
      if (Number.isFinite(numeric)) {
        return { value: numeric >= PASSING_GRADE ? "A" : "X", isUnknown: false };
      }
    }
    return { value: null, isUnknown: true };
  }

  return { value: null, isUnknown: true };
}

/** Repara texto que fue decodificado como Latin-1 siendo UTF-8 (por ejemplo, "3Âª" -> "3ª"). */
export function repairMojibake(raw: string): string {
  if (!/[ÃÂ]/.test(raw)) return raw;
  try {
    const bytes = Uint8Array.from(Array.from(raw).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded && decoded !== raw ? decoded : raw;
  } catch {
    return raw;
  }
}

export function normalizeText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = repairMojibake(String(raw)).trim();
  return text === "" ? null : text;
}

export function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return repairMojibake(String(raw))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHeaderKey(raw: unknown): string {
  return normalizeHeader(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeSubjectName(raw: unknown): string {
  const name = normalizeHeader(raw);
  return name.replace(/\s+/g, " ").trim();
}

export function createInternalStudentId(
  fileName: string,
  sheetName: string,
  rowIndex: number,
): string {
  return `${fileName}::${sheetName}::row-${rowIndex}`;
}
