import type { NormalizedDataset, StudentRecord } from "@/types/academic";
import type {
  SituationCategory,
  StudentAnalysis,
  StudentSummary,
  SubjectAnalysis,
} from "@/types/analysis";

export function analyzeSubject(subject: string, grades: { "1C": "A" | "X" | null; "2C": "A" | "X" | null }): SubjectAnalysis {
  const g1 = grades["1C"];
  const g2 = grades["2C"];
  const missingPeriods = (["1C", "2C"] as const).filter((p) => grades[p] === null);
  const disapprovedPeriods = (["1C", "2C"] as const).filter((p) => grades[p] === "X");

  const isPersistentDifficulty = g1 === "X" && g2 === "X";
  const isPositiveEvolution = g1 === "X" && g2 === "A";
  const isRecentDifficulty = g1 === "A" && g2 === "X";
  const isApprovedBoth = g1 === "A" && g2 === "A";
  const isIncomplete = g1 === null || g2 === null;
  const hasDisapproval = g1 === "X" || g2 === "X";

  return {
    subject,
    grades: { "1C": g1, "2C": g2 },
    hasDisapproval,
    isPersistentDifficulty,
    isPositiveEvolution,
    isRecentDifficulty,
    isApprovedBoth,
    isIncomplete,
    missingPeriods,
    disapprovedPeriods,
  };
}

export function analyzeStudent(student: StudentRecord, subjectsOrder: string[]): StudentAnalysis {
  const subjects: SubjectAnalysis[] = subjectsOrder.map((subject) =>
    analyzeSubject(subject, student.subjects[subject] ?? { "1C": null, "2C": null }),
  );

  let approved = 0;
  let disapproved = 0;
  let missing = 0;
  let subjectsWithAnyDisapproval = 0;
  let subjectsWithPersistentDifficulty = 0;
  let subjectsWithPositiveEvolution = 0;
  let subjectsWithRecentDifficulty = 0;
  let subjectsWithIncompleteInformation = 0;

  for (const s of subjects) {
    if (s.grades["1C"] === "A") approved++;
    else if (s.grades["1C"] === "X") disapproved++;
    else missing++;
    if (s.grades["2C"] === "A") approved++;
    else if (s.grades["2C"] === "X") disapproved++;
    else missing++;

    if (s.hasDisapproval) subjectsWithAnyDisapproval++;
    if (s.isPersistentDifficulty) subjectsWithPersistentDifficulty++;
    if (s.isPositiveEvolution) subjectsWithPositiveEvolution++;
    if (s.isRecentDifficulty) subjectsWithRecentDifficulty++;
    if (s.isIncomplete) subjectsWithIncompleteInformation++;
  }

  const summary: StudentSummary = {
    approved,
    disapproved,
    missing,
    subjectsWithAnyDisapproval,
    subjectsWithPersistentDifficulty,
    subjectsWithPositiveEvolution,
    subjectsWithRecentDifficulty,
    subjectsWithIncompleteInformation,
  };

  const categories: SituationCategory[] = [];
  if (subjectsWithPersistentDifficulty > 0) categories.push("priority_attention");
  if (subjectsWithAnyDisapproval > 0) categories.push("requires_attention");
  if (subjectsWithPositiveEvolution > 0) categories.push("positive_evolution");
  if (subjectsWithRecentDifficulty > 0) categories.push("recent_difficulty");
  if (subjectsWithIncompleteInformation > 0) categories.push("incomplete_information");
  if (subjectsWithAnyDisapproval === 0) categories.push("no_disapprovals_recorded");

  return {
    studentId: student.id,
    studentName: student.name,
    studentNumber: student.studentNumber,
    subjects,
    summary,
    categories,
  };
}

export function analyzeDataset(dataset: NormalizedDataset): StudentAnalysis[] {
  return dataset.students.map((student) => analyzeStudent(student, dataset.subjects));
}
