import type { NormalizedDataset } from "@/types/academic";
import type { StudentAnalysis } from "@/types/analysis";
import type { ObservationResult } from "@/types/observations";

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
