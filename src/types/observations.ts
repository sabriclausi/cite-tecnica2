import type { Priority, SituationCategory, SituationType, StudentSummary } from "./analysis";

export interface DetectedSituation {
  type: SituationType;
  category: SituationCategory;
  subject?: string;
  subjects?: string[];
  periods?: Array<"1C" | "2C">;
  priority: Priority;
  description: string;
}

export interface Recommendation {
  type:
    | "recovery"
    | "priority_support"
    | "sustain_progress"
    | "review_recent"
    | "verify_information"
    | "global_recovery_plan";
  subjects?: string[];
  priority: Priority;
  text: string;
}

export interface GeneratedText {
  academicSituation: string;
  evolution: string;
  recommendations: string;
}

export interface ObservationResult {
  studentId: string;
  studentName: string;
  summary: StudentSummary;
  situations: DetectedSituation[];
  recommendations: Recommendation[];
  generatedText: GeneratedText;
  generatedAt: string;
}
