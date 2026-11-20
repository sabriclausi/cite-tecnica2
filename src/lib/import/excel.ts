import * as XLSX from "xlsx";
import type {
  ColumnMapping,
  GradeValue,
  ImportWarning,
  NormalizedDataset,
  StudentRecord,
  WorkbookImportResult,
} from "@/types/academic";
import {
  createInternalStudentId,
  normalizeGradeValue,
  normalizeHeader,
  normalizeHeaderKey,
  normalizeSubjectName,
  normalizeText,
} from "@/lib/normalization/values";

type CellMatrix = unknown[][];

const NAME_KEYS = new Set([
  "nombre",
  "nombres",
  "estudiante",
  "estudiantes",
  "alumno",
  "alumnos",
  "nombre del alumno",
  "nombre y apellido",
  "apellido y nombre",
  "apellidos y nombres",
  "nombres y apellidos",
]);

const NUMBER_KEYS = new Set([
  "n",
  "nª",
  "nº",
  "no",
  "nro",
  "num",
  "numero",
  "n alumno",
  "numero de alumno",
]);

const DNI_KEYS = new Set(["dni", "documento", "nro documento", "numero de documento", "doc"]);

const OBS_KEYS = new Set([
  "observaciones",
  "observacion",
  "obs",
  "observaciones originales",
  "comentarios",
]);

function isPeriodHeader(value: unknown): "1C" | "2C" | null {
  const key = normalizeHeaderKey(value).replace(/\s+/g, "");
  if (
    key === "1c" ||
    key === "1cuat" ||
    key === "1cuatrimestre" ||
    key === "primercuatrimestre" ||
    key === "1ercuatrimestre" ||
    key === "primertrimestre"
  ) {
    return "1C";
  }
  if (
    key === "2c" ||
    key === "2cuat" ||
    key === "2cuatrimestre" ||
    key === "segundocuatrimestre" ||
    key === "2docuatrimestre" ||
    key === "segundotrimestre"
  ) {
    return "2C";
  }
  return null;
}

function getCell(row: unknown[] | undefined, col: number): unknown {
  if (!row) return undefined;
  return row[col];
}

function rowNonEmptyCount(row: unknown[] | undefined): number {
  if (!row) return 0;
  return row.reduce<number>((acc, cell) => acc + (normalizeHeader(cell) !== "" ? 1 : 0), 0);
}

function detectHeaderRowIndex(matrix: CellMatrix): number {
  let bestIndex = -1;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 30);

  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    const keys = row.map(normalizeHeaderKey);
    const periodCount = row.filter((c) => isPeriodHeader(c) !== null).length;
    let score = 0;
    if (keys.some((k) => NAME_KEYS.has(k))) score += 5;
    if (keys.some((k) => NUMBER_KEYS.has(k))) score += 2;
    if (keys.some((k) => DNI_KEYS.has(k))) score += 1;
    if (keys.some((k) => OBS_KEYS.has(k))) score += 1;
    if (periodCount >= 2) score += 4;
    if (periodCount >= 6) score += 2;
    // Penalizar filas casi vacías
    if (rowNonEmptyCount(row) < 2) score -= 5;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex === -1 || bestScore < 3) {
    const fallback = matrix.findIndex((r) => rowNonEmptyCount(r) > 0);
    return fallback === -1 ? 0 : fallback;
  }
  return bestIndex;
}

function detectSubjectRowIndex(matrix: CellMatrix, headerRowIndex: number): number | null {
  // Busca en filas superiores una fila con nombres de materias alineados a columnas de período
  const headerRow = matrix[headerRowIndex] ?? [];
  const periodCols = headerRow
    .map((c, idx) => (isPeriodHeader(c) ? idx : -1))
    .filter((idx) => idx >= 0);
  if (periodCols.length === 0) return null;

  for (let i = headerRowIndex - 1; i >= 0 && i >= headerRowIndex - 6; i--) {
    const row = matrix[i] ?? [];
    let matches = 0;
    for (const col of periodCols) {
      const text = normalizeHeader(getCell(row, col));
      if (!text) continue;
      const key = normalizeHeaderKey(text);
      if (NAME_KEYS.has(key) || DNI_KEYS.has(key) || NUMBER_KEYS.has(key) || OBS_KEYS.has(key)) continue;
      if (isPeriodHeader(text)) continue;
      matches++;
    }
    if (matches >= 1 && rowNonEmptyCount(row) >= 1) {
      return i;
    }
  }
  return null;
}

function findSubjectNameInRow(row: unknown[] | undefined, col: number): string | null {
  if (!row) return null;
  // Buscar hacia la izquierda desde la columna del período (maneja celdas fusionadas/exportadas)
  for (let c = col; c >= 0; c--) {
    const text = normalizeHeader(getCell(row, c));
    if (!text) continue;
    const key = normalizeHeaderKey(text);
    if (NAME_KEYS.has(key) || DNI_KEYS.has(key) || NUMBER_KEYS.has(key) || OBS_KEYS.has(key)) continue;
    if (isPeriodHeader(text)) continue;
    return normalizeSubjectName(text);
  }
  return null;
}

function buildColumnMapping(matrix: CellMatrix): { mapping: ColumnMapping; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const headerRowIndex = detectHeaderRowIndex(matrix);
  const headerRow = matrix[headerRowIndex] ?? [];
  const subjectRowIndex = detectSubjectRowIndex(matrix, headerRowIndex);
  const subjectRow = subjectRowIndex !== null ? matrix[subjectRowIndex] ?? [] : null;

  const colCount = matrix.reduce((max, row) => Math.max(max, (row ?? []).length), 0);

  const mapping: ColumnMapping = {
    studentNumberColumn: null,
    nameColumn: null,
    dniColumn: null,
    observationColumn: null,
    subjectColumns: {},
    headerRowIndex,
    periodHeaderRowIndex: null,
  };

  // Columnas especiales en fila de encabezado principal
  for (let c = 0; c < colCount; c++) {
    const header = normalizeHeader(getCell(headerRow, c));
    const key = normalizeHeaderKey(header);
    if (!header) continue;
    if (NAME_KEYS.has(key) && mapping.nameColumn === null) {
      mapping.nameColumn = c;
      continue;
    }
    if (DNI_KEYS.has(key) && mapping.dniColumn === null) {
      mapping.dniColumn = c;
      continue;
    }
    if (OBS_KEYS.has(key) && mapping.observationColumn === null) {
      mapping.observationColumn = c;
      continue;
    }
    if (NUMBER_KEYS.has(key) && mapping.studentNumberColumn === null) {
      mapping.studentNumberColumn = c;
      continue;
    }
  }

  // Caso 1: fila de encabezado contiene períodos (1C/2C) y materias están en fila superior
  const headerHasPeriods = headerRow.some((c) => isPeriodHeader(c) !== null);
  if (headerHasPeriods) {
    mapping.periodHeaderRowIndex = headerRowIndex;
    let lastSubject: string | null = null;
    for (let c = 0; c < colCount; c++) {
      const period = isPeriodHeader(getCell(headerRow, c));
      if (!period) continue;

      const fromSubjectRow = findSubjectNameInRow(subjectRow ?? undefined, c);
      if (fromSubjectRow) lastSubject = fromSubjectRow;

      if (!lastSubject) {
        warnings.push({
          type: "unmapped_column",
          message: `No se pudo asociar una materia a la columna de período ${period} (columna ${c + 1}).`,
          column: c,
        });
        continue;
      }

      if (!mapping.subjectColumns[lastSubject]) {
        mapping.subjectColumns[lastSubject] = { "1C": null, "2C": null };
      }
      mapping.subjectColumns[lastSubject][period] = c;
    }

    // Columna de observaciones: si no hay encabezado "Observaciones", usar primera columna no mapeada al final
    if (mapping.observationColumn === null) {
      const used = new Set<number>();
      if (mapping.studentNumberColumn !== null) used.add(mapping.studentNumberColumn);
      if (mapping.nameColumn !== null) used.add(mapping.nameColumn);
      if (mapping.dniColumn !== null) used.add(mapping.dniColumn);
      for (const cols of Object.values(mapping.subjectColumns)) {
        if (cols["1C"] !== null) used.add(cols["1C"]);
        if (cols["2C"] !== null) used.add(cols["2C"]);
      }
      for (let c = colCount - 1; c >= 0; c--) {
        if (used.has(c)) continue;
        const header = normalizeHeader(getCell(headerRow, c));
        if (header === "" || OBS_KEYS.has(normalizeHeaderKey(header))) {
          // Heurística: tratar última columna libre como observaciones
          mapping.observationColumn = c;
          break;
        }
      }
    }
  } else if (subjectRowIndex !== null) {
    // Caso 2: fila de materias arriba y fila de períodos abajo
    const periodRow = matrix[headerRowIndex + 1] ?? [];
    const periodCount = periodRow.filter((c) => isPeriodHeader(c) !== null).length;
    if (periodCount >= 2) {
      mapping.periodHeaderRowIndex = headerRowIndex + 1;
      let lastSubject: string | null = null;
      for (let c = 0; c < colCount; c++) {
        const topHeader = normalizeHeader(getCell(subjectRow ?? undefined, c));
        if (topHeader) {
          const key = normalizeHeaderKey(topHeader);
          if (!NAME_KEYS.has(key) && !DNI_KEYS.has(key) && !NUMBER_KEYS.has(key) && !OBS_KEYS.has(key) && !isPeriodHeader(topHeader)) {
            lastSubject = normalizeSubjectName(topHeader);
            if (lastSubject && !mapping.subjectColumns[lastSubject]) {
              mapping.subjectColumns[lastSubject] = { "1C": null, "2C": null };
            }
          }
        }
        const period = isPeriodHeader(getCell(periodRow, c));
        if (period && lastSubject) {
          mapping.subjectColumns[lastSubject][period] = c;
        }
      }
    }
  } else {
    // Caso 3: encabezados tipo "Materia 1C" / "Materia 2C"
    for (let c = 0; c < colCount; c++) {
      const header = normalizeHeader(getCell(headerRow, c));
      if (!header) continue;
      const key = normalizeHeaderKey(header);
      if (NAME_KEYS.has(key) || DNI_KEYS.has(key) || OBS_KEYS.has(key) || NUMBER_KEYS.has(key)) continue;

      const match = header.match(
        /^(.*?)(?:\s+|\s*[-–]\s*)(1C|2C|1er\s*Cuat\.?|2do\s*Cuat\.?|Primer\s*Cuatrimestre|Segundo\s*Cuatrimestre)$/i,
      );
      if (match) {
        const subject = normalizeSubjectName(match[1]);
        const period: "1C" | "2C" = match[2].toUpperCase().startsWith("1") ? "1C" : "2C";
        if (!mapping.subjectColumns[subject]) {
          mapping.subjectColumns[subject] = { "1C": null, "2C": null };
        }
        mapping.subjectColumns[subject][period] = c;
      } else if (!isPeriodHeader(header)) {
        warnings.push({
          type: "unmapped_column",
          message: `Columna no reconocida: "${header}"`,
          column: c,
        });
      }
    }
  }

  // Fallback de columna de nombre si no se detectó (buscar por contenido)
  if (mapping.nameColumn === null) {
    const dataStart = (mapping.periodHeaderRowIndex ?? headerRowIndex) + 1;
    let bestCol = -1;
    let bestScore = -1;
    for (let c = 0; c < colCount; c++) {
      if (c === mapping.studentNumberColumn || c === mapping.dniColumn) continue;
      if (Object.values(mapping.subjectColumns).some((sc) => sc["1C"] === c || sc["2C"] === c)) continue;
      let score = 0;
      for (let r = dataStart; r < Math.min(matrix.length, dataStart + 20); r++) {
        const val = normalizeText(getCell(matrix[r], c));
        if (!val) continue;
        if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(val) && !/^([AXax])$/.test(val.trim())) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }
    if (bestCol !== -1 && bestScore >= 2) {
      mapping.nameColumn = bestCol;
    }
  }

  if (mapping.nameColumn === null) {
    warnings.push({ type: "missing_header", message: "No se pudo identificar la columna de nombre del alumno." });
  }

  for (const [subject, cols] of Object.entries(mapping.subjectColumns)) {
    if (cols["1C"] === null || cols["2C"] === null) {
      warnings.push({
        type: "missing_period",
        message: `La materia "${subject}" no tiene ambas columnas de período (1C/2C) identificadas.`,
      });
    }
  }

  return { mapping, warnings };
}

function isRowEmpty(row: unknown[] | undefined): boolean {
  if (!row) return true;
  return row.every((cell) => normalizeText(cell) === null);
}

export function parseSheetToDataset(
  matrix: CellMatrix,
  context: { fileName: string; sheetName: string; importedAt: string },
): NormalizedDataset {
  const { mapping, warnings } = buildColumnMapping(matrix);
  const dataStart = (mapping.periodHeaderRowIndex ?? mapping.headerRowIndex) + 1;
  const subjects = Object.keys(mapping.subjectColumns);
  const students: StudentRecord[] = [];

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r];
    if (isRowEmpty(row)) continue;

    const name = mapping.nameColumn !== null ? normalizeText(getCell(row, mapping.nameColumn)) : null;
    const studentNumber = mapping.studentNumberColumn !== null ? normalizeText(getCell(row, mapping.studentNumberColumn)) : null;
    const dni = mapping.dniColumn !== null ? normalizeText(getCell(row, mapping.dniColumn)) : null;
    const originalObservation =
      mapping.observationColumn !== null ? normalizeText(getCell(row, mapping.observationColumn)) : null;

    const hasAnyGrade = subjects.some((subject) => {
      const cols = mapping.subjectColumns[subject];
      const v1 = cols["1C"] !== null ? normalizeText(getCell(row, cols["1C"])) : null;
      const v2 = cols["2C"] !== null ? normalizeText(getCell(row, cols["2C"])) : null;
      return v1 !== null || v2 !== null;
    });
    if (!name && !studentNumber && !hasAnyGrade) continue;

    const subjectGrades: StudentRecord["subjects"] = {};
    for (const subject of subjects) {
      const cols = mapping.subjectColumns[subject];
      const readGrade = (col: number | null): GradeValue => {
        if (col === null) return null;
        const res = normalizeGradeValue(getCell(row, col));
        if (res.isUnknown) {
          warnings.push({
            type: "unknown_value",
            message: `Valor no reconocido en "${subject}" (fila ${r + 1}, columna ${col + 1}): se interpretó como vacío.`,
            row: r + 1,
            column: col,
          });
        }
        return res.value;
      };
      subjectGrades[subject] = {
        "1C": readGrade(cols["1C"]),
        "2C": readGrade(cols["2C"]),
      };
    }

    students.push({
      id: createInternalStudentId(context.fileName, context.sheetName, r + 1),
      studentNumber,
      name: name ?? "(Sin nombre)",
      dni,
      subjects: subjectGrades,
      originalObservation,
      sourceRow: r + 1,
    });
  }

  if (students.length === 0) {
    warnings.push({ type: "empty_sheet", message: `La hoja "${context.sheetName}" no contiene alumnos reconocibles.` });
  }

  return {
    id: `${context.fileName}::${context.sheetName}`,
    context: {
      fileName: context.fileName,
      sheetName: context.sheetName,
      importedAt: context.importedAt,
    },
    subjects,
    students,
    mapping,
    warnings,
  };
}

export async function importWorkbookFile(file: File): Promise<WorkbookImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const importedAt = new Date().toISOString();
  const datasets: NormalizedDataset[] = [];
  const warnings: ImportWarning[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
      blankrows: false,
    }) as CellMatrix;

    if (!matrix || matrix.length === 0) {
      warnings.push({ type: "empty_sheet", message: `La hoja "${sheetName}" está vacía.` });
      continue;
    }

    datasets.push(parseSheetToDataset(matrix, { fileName: file.name, sheetName, importedAt }));
  }

  return { datasets, warnings };
}
