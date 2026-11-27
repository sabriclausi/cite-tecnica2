import type { NormalizedDataset, Period } from "@/types/academic";
import type { StudentAnalysis } from "@/types/analysis";
import type { ObservationResult } from "@/types/observations";
import { normalizeHeaderKey, repairMojibake } from "@/lib/normalization/values";

export interface CourseAggregations {
  totalStudents: number;
  counts: {
    requiresAttention: number;
    priorityAttention: number;
    positiveEvolution: number;
    recentDifficulty: number;
    incompleteInformation: number;
    noDisapprovalsRecorded: number;
  };
  situationsBySubject: { subject: string; count: number }[];
  persistentDifficultiesBySubject: { subject: string; count: number }[];
  recommendationsByType: { type: string; label: string; count: number }[];
  pendingSubjectsDistribution: { pendingCount: number; students: number }[];
  periodComparison: { period: string; approved: number; disapproved: number; missing: number }[];
  matrix: {
    studentLabels: string[];
    subjects: string[];
    /** values: 0 none, 1 disapproved/attention, 2 persistent, 3 positive evolution, 4 recent difficulty, 5 incomplete only */
    cells: number[][];
  };
}

const recommendationLabels: Record<string, string> = {
  recovery: "Recuperación",
  priority_support: "Acompañamiento prioritario",
  sustain_progress: "Sostener avances",
  review_recent: "Revisar período reciente",
  verify_information: "Verificar información",
  global_recovery_plan: "Plan global de recuperación",
};

export function aggregateCourseData(
  dataset: NormalizedDataset,
  analyses: StudentAnalysis[],
  observations: ObservationResult[],
): CourseAggregations {
  const totalStudents = analyses.length;

  const counts = {
    requiresAttention: analyses.filter((a) => a.categories.includes("requires_attention")).length,
    priorityAttention: analyses.filter((a) => a.categories.includes("priority_attention")).length,
    positiveEvolution: analyses.filter((a) => a.categories.includes("positive_evolution")).length,
    recentDifficulty: analyses.filter((a) => a.categories.includes("recent_difficulty")).length,
    incompleteInformation: analyses.filter((a) => a.categories.includes("incomplete_information")).length,
    noDisapprovalsRecorded: analyses.filter((a) => a.categories.includes("no_disapprovals_recorded")).length,
  };

  const situationMap = new Map<string, number>();
  const persistentMap = new Map<string, number>();
  for (const a of analyses) {
    for (const s of a.subjects) {
      if (s.hasDisapproval || s.isIncomplete) {
        situationMap.set(s.subject, (situationMap.get(s.subject) ?? 0) + 1);
      }
      if (s.isPersistentDifficulty) {
        persistentMap.set(s.subject, (persistentMap.get(s.subject) ?? 0) + 1);
      }
    }
  }

  const situationsBySubject = dataset.subjects.map((subject) => ({
    subject,
    count: situationMap.get(subject) ?? 0,
  }));

  const persistentDifficultiesBySubject = dataset.subjects.map((subject) => ({
    subject,
    count: persistentMap.get(subject) ?? 0,
  }));

  const recMap = new Map<string, number>();
  for (const o of observations) {
    for (const r of o.recommendations) {
      recMap.set(r.type, (recMap.get(r.type) ?? 0) + 1);
    }
  }
  const recommendationsByType = Array.from(recMap.entries()).map(([type, count]) => ({
    type,
    label: recommendationLabels[type] ?? type,
    count,
  }));

  const pendingDistMap = new Map<number, number>();
  for (const a of analyses) {
    const n = a.summary.subjectsWithAnyDisapproval;
    pendingDistMap.set(n, (pendingDistMap.get(n) ?? 0) + 1);
  }
  const maxPending = Math.max(0, ...Array.from(pendingDistMap.keys()));
  const pendingSubjectsDistribution: { pendingCount: number; students: number }[] = [];
  for (let i = 0; i <= maxPending; i++) {
    pendingSubjectsDistribution.push({ pendingCount: i, students: pendingDistMap.get(i) ?? 0 });
  }

  let c1a = 0, c1x = 0, c1m = 0, c2a = 0, c2x = 0, c2m = 0;
  for (const a of analyses) {
    for (const s of a.subjects) {
      if (s.grades["1C"] === "A") c1a++; else if (s.grades["1C"] === "X") c1x++; else c1m++;
      if (s.grades["2C"] === "A") c2a++; else if (s.grades["2C"] === "X") c2x++; else c2m++;
    }
  }
  const periodComparison = [
    { period: "1C", approved: c1a, disapproved: c1x, missing: c1m },
    { period: "2C", approved: c2a, disapproved: c2x, missing: c2m },
  ];

  const studentLabels = analyses.map((a, idx) =>
    a.studentNumber ? `Alumno ${a.studentNumber}` : `Alumno ${idx + 1}`,
  );
  const matrixCells = analyses.map((a) =>
    a.subjects.map((s) => {
      if (s.isPersistentDifficulty) return 2;
      if (s.isPositiveEvolution) return 3;
      if (s.isRecentDifficulty) return 4;
      if (s.hasDisapproval) return 1;
      if (s.isIncomplete) return 5;
      return 0;
    }),
  );

  return {
    totalStudents,
    counts,
    situationsBySubject,
    persistentDifficultiesBySubject,
    recommendationsByType,
    pendingSubjectsDistribution,
    periodComparison,
    matrix: { studentLabels, subjects: dataset.subjects, cells: matrixCells },
  };
}

/** Conteo de desaprobaciones separado por cuatrimestre, con porcentajes sobre la base correspondiente. */
export interface DisapprovalsByPeriodMetric {
  period: Period;
  disapprovedResults: number;
  evaluatedResults: number;
  disapprovedPercentage: number;
  studentsWithDisapproval: number;
  totalStudents: number;
  studentsPercentage: number;
}

export function getDisapprovalsByPeriod(analyses: StudentAnalysis[]): DisapprovalsByPeriodMetric[] {
  const totalStudents = analyses.length;

  return (["1C", "2C"] as const).map((period) => {
    let disapprovedResults = 0;
    let evaluatedResults = 0;
    let studentsWithDisapproval = 0;

    for (const analysis of analyses) {
      let studentHasDisapproval = false;
      for (const subject of analysis.subjects) {
        const grade = subject.grades[period];
        if (grade === "A" || grade === "X") evaluatedResults++;
        if (grade === "X") {
          disapprovedResults++;
          studentHasDisapproval = true;
        }
      }
      if (studentHasDisapproval) studentsWithDisapproval++;
    }

    return {
      period,
      disapprovedResults,
      evaluatedResults,
      disapprovedPercentage: evaluatedResults > 0 ? (disapprovedResults / evaluatedResults) * 100 : 0,
      studentsWithDisapproval,
      totalStudents,
      studentsPercentage: totalStudents > 0 ? (studentsWithDisapproval / totalStudents) * 100 : 0,
    };
  });
}

const observationStopWords = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "un", "una"]);

function observationWords(raw: string): string[] {
  return normalizeHeaderKey(raw)
    // "2ª", "2do", etc. se convierten en "2 a", "2 do"; no son parte del nombre de la materia.
    .replace(/\b\d{1,2}(?:\s+[a-z]+)?\b/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function observationTokens(raw: string): string[] {
  return observationWords(raw).filter((token) => !observationStopWords.has(token));
}

function splitObservationText(text: string): string[] {
  return text
    .split(/[\n,;/|]|\s*-\s*/)
    .map((fragment) => repairMojibake(fragment.trim()))
    .filter((fragment) => fragment.length > 0);
}

function observationTokenMatches(fragmentToken: string, subjectToken: string): boolean {
  if (fragmentToken === subjectToken) return true;
  // Iniciales ("P.D.Leng." -> P, D, Leng) y abreviaturas por prefijo ("Hist." -> "historia").
  if (fragmentToken.length === 1) return subjectToken.startsWith(fragmentToken);
  if (fragmentToken.length >= 3 && subjectToken.length >= 3) {
    if (fragmentToken.slice(0, 3) === subjectToken.slice(0, 3)) return true;
    return subjectToken.startsWith(fragmentToken) || fragmentToken.startsWith(subjectToken);
  }
  return false;
}

function matchesCompoundAbbreviation(fragmentToken: string, subjectTokens: string[]): boolean {
  if (fragmentToken.length < 5 || subjectTokens.length < 2) return false;
  const abbreviation = subjectTokens.map((token) => token.slice(0, 3)).join("");
  return abbreviation.startsWith(fragmentToken) || fragmentToken.startsWith(abbreviation);
}

function matchObservationSubject(
  fragment: string,
  subjects: Array<{ name: string; key: string; words: string[]; contentTokens: string[] }>,
): string | null {
  const tokens = observationTokens(fragment);
  if (tokens.length === 0) return null;

  const key = tokens.join(" ");
  const exact = subjects.find((subject) => subject.key === key);
  if (exact) return exact.name;

  let best: { name: string; score: number } | null = null;
  for (const subject of subjects) {
    const available = [...subject.words];
    let matched = 0;
    let compoundMatches = 0;

    for (const token of tokens) {
      // Primero las abreviaturas compuestas ("FisQuim" -> "Física y Química") para no
      // quedarse con una materia de un solo token que comparte las primeras letras.
      let index = available.length > 0 && matchesCompoundAbbreviation(token, subject.contentTokens) ? 0 : -1;
      if (index !== -1) compoundMatches++;
      else index = available.findIndex((word) => observationTokenMatches(token, word));
      if (index === -1) break;
      available.splice(index, 1);
      matched++;
    }

    if (matched !== tokens.length) continue;
    const score = matched / Math.max(subject.words.length, 1) + compoundMatches;
    if (!best || score > best.score) best = { name: subject.name, score };
  }
  return best?.name ?? null;
}

export interface ObservationStudentRow {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  /** Materias detectadas en el texto de observaciones originales. */
  subjects: string[];
  /** Fragmentos que no pudieron asociarse a ninguna materia. */
  unmatched: string[];
}

export interface ObservationMetrics {
  rows: ObservationStudentRow[];
  bySubject: Array<{ subject: string; students: number; percentage: number }>;
  studentsWithObservations: number;
  unmatchedFragments: number;
  totalStudents: number;
}

/** Materias mencionadas en la columna "Observaciones" original de la planilla. */
export function getObservationMetrics(dataset: NormalizedDataset): ObservationMetrics {
  const subjectEntries = dataset.subjects.map((name) => ({
    name,
    key: observationTokens(name).join(" "),
    words: observationWords(name),
    contentTokens: observationTokens(name),
  }));
  const subjectCounts = new Map<string, number>();
  const rows: ObservationStudentRow[] = [];
  let studentsWithObservations = 0;
  let unmatchedFragments = 0;

  for (const student of dataset.students) {
    const matchedSubjects = new Set<string>();
    const unmatched = new Set<string>();

    if (student.originalObservation) {
      for (const fragment of splitObservationText(student.originalObservation)) {
        const subject = matchObservationSubject(fragment, subjectEntries);
        if (subject) matchedSubjects.add(subject);
        else unmatched.add(fragment);
      }
    }

    if (matchedSubjects.size > 0 || unmatched.size > 0) studentsWithObservations++;
    unmatchedFragments += unmatched.size;
    for (const subject of matchedSubjects) {
      subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
    }
    rows.push({
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.studentNumber,
      subjects: [...matchedSubjects],
      unmatched: [...unmatched],
    });
  }

  const totalStudents = dataset.students.length;
  const bySubject = dataset.subjects
    .map((subject) => {
      const students = subjectCounts.get(subject) ?? 0;
      return {
        subject,
        students,
        percentage: totalStudents > 0 ? (students / totalStudents) * 100 : 0,
      };
    })
    .filter((entry) => entry.students > 0)
    .sort((a, b) => b.students - a.students || a.subject.localeCompare(b.subject));

  return {
    rows,
    bySubject,
    studentsWithObservations,
    unmatchedFragments,
    totalStudents,
  };
}

export interface DisapprovedStudentRow {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  disapprovedSubjects: number;
}

export interface DisapprovalBuckets {
  fiveOrMore: DisapprovedStudentRow[];
  oneToFour: DisapprovedStudentRow[];
  none: DisapprovedStudentRow[];
  withAny: number;
  totalStudents: number;
  withAnyPercentage: number;
  withoutPercentage: number;
}

/** Alumnos agrupados por cantidad de materias desaprobadas (5 o más / 1 a 4 / ninguna). */
export function getStudentsByDisapprovedSubjects(
  analyses: StudentAnalysis[],
  period: "both" | Period,
): DisapprovalBuckets {
  const rows: DisapprovedStudentRow[] = analyses.map((analysis) => ({
    studentId: analysis.studentId,
    studentName: analysis.studentName,
    studentNumber: analysis.studentNumber,
    disapprovedSubjects:
      period === "both"
        ? analysis.summary.subjectsWithAnyDisapproval
        : analysis.subjects.filter((subject) => subject.grades[period] === "X").length,
  }));

  const totalStudents = rows.length;
  const withAny = rows.filter((row) => row.disapprovedSubjects > 0).length;
  const without = totalStudents - withAny;

  return {
    fiveOrMore: rows.filter((row) => row.disapprovedSubjects >= 5),
    oneToFour: rows.filter((row) => row.disapprovedSubjects >= 1 && row.disapprovedSubjects <= 4),
    none: rows.filter((row) => row.disapprovedSubjects === 0),
    withAny,
    totalStudents,
    withAnyPercentage: totalStudents > 0 ? (withAny / totalStudents) * 100 : 0,
    withoutPercentage: totalStudents > 0 ? (without / totalStudents) * 100 : 0,
  };
}
