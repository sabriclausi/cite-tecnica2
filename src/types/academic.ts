export type Period = "1C" | "2C";

export type GradeValue = "A" | "X" | null;

export interface SubjectGrades {
  "1C": GradeValue;
  "2C": GradeValue;
}

export interface StudentRecord {
  /** Internal identifier (never DNI). */
  id: string;
  /** Número de alumno según planilla, si está disponible. */
  studentNumber: string | null;
  name: string;
  /** DNI conservado solo para uso interno (p.ej. comparación histórica). No mostrar/exportar por defecto. */
  dni: string | null;
  /** Resultados por materia normalizada. */
  subjects: Record<string, SubjectGrades>;
  /** Observación original de la planilla, sin interpretar como resultado académico. */
  originalObservation: string | null;
  /** Índice de fila de origen (1-based en datos, orientativo). */
  sourceRow: number;
}

export interface DatasetContext {
  fileName: string;
  sheetName: string;
  year?: string;
  course?: string;
  division?: string;
  importedAt: string;
}

export interface ColumnMapping {
  studentNumberColumn: number | null;
  nameColumn: number | null;
  dniColumn: number | null;
  observationColumn: number | null;
  /** Mapa materia normalizada -> índices de columna para 1C y 2C. */
  subjectColumns: Record<string, { "1C": number | null; "2C": number | null }>;
  headerRowIndex: number;
  periodHeaderRowIndex: number | null;
}

export interface ImportWarning {
  type:
    | "missing_header"
    | "unknown_value"
    | "unmapped_column"
    | "missing_period"
    | "empty_sheet"
    | "parse_issue";
  message: string;
  row?: number;
  column?: number;
}

export interface NormalizedDataset {
  id: string;
  context: DatasetContext;
  /** Materias detectadas en orden. */
  subjects: string[];
  students: StudentRecord[];
  mapping: ColumnMapping;
  warnings: ImportWarning[];
}

export interface WorkbookImportResult {
  datasets: NormalizedDataset[];
  warnings: ImportWarning[];
}
