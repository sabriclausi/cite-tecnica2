import type { GradeValue, Period } from "./academic";

export type SituationType =
  | "disapproved"
  | "persistent_difficulty"
  | "positive_evolution"
  | "recent_difficulty"
  | "approved_both"
  | "incomplete_information"
  | "no_disapprovals_recorded";

export type SituationCategory =
  | "requires_attention"
  | "priority_attention"
  | "positive_evolution"
  | "recent_difficulty"
  | "incomplete_information"
  | "no_disapprovals_recorded";

export type Priority = "high" | "normal" | "low";

export interface SubjectAnalysis {
  subject: string;
  grades: { "1C": GradeValue; "2C": GradeValue };
  hasDisapproval: boolean;
  isPersistentDifficulty: boolean;
  isPositiveEvolution: boolean;
  isRecentDifficulty: boolean;
  isApprovedBoth: boolean;
  isIncomplete: boolean;
  /** Períodos con información faltante. */
  missingPeriods: Period[];
  /** Períodos con X. */
  disapprovedPeriods: Period[];
}

export interface StudentSummary {
  approved: number;
  disapproved: number;
  missing: number;
  /** Materias con al menos un X. */
  subjectsWithAnyDisapproval: number;
  /** Materias con X en ambos períodos. */
  subjectsWithPersistentDifficulty: number;
  /** Materias con X en 1C y A en 2C. */
  subjectsWithPositiveEvolution: number;
  /** Materias con A en 1C y X en 2C. */
  subjectsWithRecentDifficulty: number;
  /** Materias con algún período vacío. */
  subjectsWithIncompleteInformation: number;
}

export interface StudentAnalysis {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  subjects: SubjectAnalysis[];
  summary: StudentSummary;
  categories: SituationCategory[];
}
