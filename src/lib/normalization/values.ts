import type { GradeValue } from "@/types/academic";

/**
 * Normaliza un valor de calificación del Excel.
 * - A/a (con espacios) => 'A'
 * - X/x (con espacios) => 'X'
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

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return { value: null, isUnknown: false };
    }
    const upper = trimmed.toUpperCase();
    if (upper === "A") return { value: "A", isUnknown: false };
    if (upper === "X") return { value: "X", isUnknown: false };
    return { value: null, isUnknown: true };
  }

  // Algunos Excels pueden traer números u otros tipos; no inferir.
  return { value: null, isUnknown: true };
}

export function normalizeText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text === "" ? null : text;
}

export function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
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
