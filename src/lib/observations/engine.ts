import type { StudentAnalysis, SubjectAnalysis } from "@/types/analysis";
import type {
  DetectedSituation,
  GeneratedText,
  ObservationResult,
  Recommendation,
} from "@/types/observations";
import {
  defaultObservationConfig,
  formatSubjectList,
  type ObservationConfig,
  type PeriodAvailability,
} from "./config";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function getPeriods(config: ObservationConfig): { "1C": PeriodAvailability; "2C": PeriodAvailability } {
  return config.periods ?? { "1C": "available", "2C": "available" };
}

function isGenuinelyIncompleteSubject(s: SubjectAnalysis, periods: { "1C": PeriodAvailability; "2C": PeriodAvailability }): boolean {
  return s.missingPeriods.some((p) => periods[p] === "available");
}

function isPendingOnlySubject(s: SubjectAnalysis, periods: { "1C": PeriodAvailability; "2C": PeriodAvailability }): boolean {
  return s.isIncomplete && s.missingPeriods.length > 0 && s.missingPeriods.every((p) => periods[p] === "pending");
}

function pendingPeriodsLabel(missingPeriods: Array<"1C" | "2C">): string {
  return missingPeriods.map((p) => (p === "1C" ? "primer período" : "segundo período")).join(" y ");
}

export function generateObservation(
  analysis: StudentAnalysis,
  config: ObservationConfig = defaultObservationConfig,
): ObservationResult {
  const periods = getPeriods(config);
  const situations: DetectedSituation[] = [];
  const { subjects, summary } = analysis;

  const disapprovedSubjects = subjects.filter((s) => s.hasDisapproval).map((s) => s.subject);
  const persistentSubjects = subjects.filter((s) => s.isPersistentDifficulty).map((s) => s.subject);
  const positiveSubjects = subjects.filter((s) => s.isPositiveEvolution).map((s) => s.subject);
  const recentSubjects = subjects.filter((s) => s.isRecentDifficulty).map((s) => s.subject);
  const incompleteSubjects = subjects.filter((s) => s.isIncomplete).map((s) => s.subject);
  const genuinelyIncompleteSubjects = subjects.filter((s) => isGenuinelyIncompleteSubject(s, periods)).map((s) => s.subject);
  const pendingOnlySubjects = subjects.filter((s) => isPendingOnlySubject(s, periods)).map((s) => s.subject);
  const approvedBothSubjects = subjects.filter((s) => s.isApprovedBoth).map((s) => s.subject);

  // Situaciones por materia/patrón
  for (const s of subjects) {
    if (s.isPersistentDifficulty) {
      situations.push({
        type: "persistent_difficulty",
        category: "priority_attention",
        subject: s.subject,
        periods: ["1C", "2C"],
        priority: "high",
        description: `Se registran resultados desaprobados en ambos períodos en ${s.subject}.`,
      });
    } else if (s.isPositiveEvolution) {
      situations.push({
        type: "positive_evolution",
        category: "positive_evolution",
        subject: s.subject,
        periods: ["1C", "2C"],
        priority: "normal",
        description: `Evolución favorable en ${s.subject}: resultado desaprobado en el primer período y aprobado en el segundo.`,
      });
    } else if (s.isRecentDifficulty) {
      situations.push({
        type: "recent_difficulty",
        category: "recent_difficulty",
        subject: s.subject,
        periods: ["1C", "2C"],
        priority: "normal",
        description: `En ${s.subject} se registra resultado aprobado en el primer período y desaprobado en el segundo.`,
      });
    } else if (s.hasDisapproval) {
      // X en algún período sin patrón de evolución reciente/persistente completo (ej. X y vacío)
      const periodText = s.disapprovedPeriods
        .map((p) => (p === "1C" ? "primer período" : "segundo período"))
        .join(" y ");
      situations.push({
        type: "disapproved",
        category: "requires_attention",
        subject: s.subject,
        periods: s.disapprovedPeriods,
        priority: "normal",
        description: `Se registra resultado desaprobado en ${s.subject} durante el ${periodText}.`,
      });
    }

    if (s.isIncomplete) {
      const missingText = s.missingPeriods
        .map((p) => (p === "1C" ? "primer período" : "segundo período"))
        .join(" y ");
      const genuine = isGenuinelyIncompleteSubject(s, periods);
      const pendingOnly = isPendingOnlySubject(s, periods);
      situations.push({
        type: "incomplete_information",
        category: "incomplete_information",
        subject: s.subject,
        periods: s.missingPeriods,
        priority: "normal",
        description: pendingOnly
          ? `Registro del ${pendingPeriodsLabel(s.missingPeriods)} pendiente en ${s.subject} (aún sin calificaciones cargadas).`
          : genuine
            ? `Información incompleta en ${s.subject} (${missingText} sin registro).`
            : `Información incompleta en ${s.subject} (${missingText} sin registro).`,
      });
    }
  }

  if (summary.subjectsWithAnyDisapproval === 0) {
    const base = "En los registros disponibles no se identifican materias con resultados desaprobados.";
    let clarification = "";
    if (genuinelyIncompleteSubjects.length > 0) {
      clarification = " Sin embargo, hay períodos sin información registrada que requieren verificación.";
    } else if (pendingOnlySubjects.length > 0) {
      clarification = " Restan registrar las calificaciones del período pendiente.";
    }
    situations.push({
      type: "no_disapprovals_recorded",
      category: "no_disapprovals_recorded",
      priority: "low",
      description: base + clarification,
    });
  }

  // Recomendaciones (sin duplicados)
  const recommendations: Recommendation[] = [];

  if (persistentSubjects.length > 0) {
    recommendations.push({
      type: "priority_support",
      subjects: persistentSubjects,
      priority: "high",
      text:
        persistentSubjects.length === 1
          ? `Se recomienda priorizar el acompañamiento y las actividades de recuperación en ${persistentSubjects[0]}, revisando los contenidos pendientes y realizando un seguimiento de su evolución.`
          : `Se recomienda priorizar el acompañamiento y las actividades de recuperación en ${formatSubjectList(persistentSubjects)}, revisando los contenidos pendientes y realizando un seguimiento de su evolución.`,
    });
  }

  // Materias con X no persistente que requieren recuperación/revisión (evitar repetir las persistentes)
  const nonPersistentDisapproved = subjects
    .filter((s) => s.hasDisapproval && !s.isPersistentDifficulty)
    .map((s) => s.subject);
  const recentOnlyForRecovery = recentSubjects.filter((s) => !persistentSubjects.includes(s));
  const otherDisapproved = nonPersistentDisapproved.filter(
    (s) => !recentOnlyForRecovery.includes(s) && !positiveSubjects.includes(s),
  );

  if (recentOnlyForRecovery.length > 0) {
    recommendations.push({
      type: "review_recent",
      subjects: recentOnlyForRecovery,
      priority: "normal",
      text:
        recentOnlyForRecovery.length === 1
          ? `Se recomienda revisar los contenidos correspondientes al segundo período en ${recentOnlyForRecovery[0]} e identificar los aspectos que requieren refuerzo.`
          : `Se recomienda revisar los contenidos correspondientes al segundo período en ${formatSubjectList(recentOnlyForRecovery)} e identificar los aspectos que requieren refuerzo.`,
    });
  }

  if (otherDisapproved.length > 0) {
    recommendations.push({
      type: "recovery",
      subjects: otherDisapproved,
      priority: "normal",
      text:
        otherDisapproved.length === 1
          ? `Se recomienda organizar instancias de recuperación para ${otherDisapproved[0]} y realizar un seguimiento de su evolución.`
          : `Se recomienda organizar instancias de recuperación para ${formatSubjectList(otherDisapproved)} y realizar un seguimiento de su evolución.`,
    });
  }

  if (positiveSubjects.length > 0) {
    recommendations.push({
      type: "sustain_progress",
      subjects: positiveSubjects,
      priority: "normal",
      text:
        positiveSubjects.length === 1
          ? `Se recomienda sostener las estrategias de acompañamiento que favorecieron la evolución favorable en ${positiveSubjects[0]}.`
          : `Se recomienda sostener las estrategias de acompañamiento que favorecieron la evolución favorable en ${formatSubjectList(positiveSubjects)}.`,
    });
  }

  if (genuinelyIncompleteSubjects.length > 0) {
    recommendations.push({
      type: "verify_information",
      subjects: genuinelyIncompleteSubjects,
      priority: "normal",
      text: `Se recomienda verificar y completar la información registrada en ${formatSubjectList(genuinelyIncompleteSubjects)} antes de elaborar una valoración académica definitiva.`,
    });
  }

  const pendingOnlyNoGenuine = pendingOnlySubjects.filter((s) => !genuinelyIncompleteSubjects.includes(s));
  if (pendingOnlyNoGenuine.length > 0) {
    recommendations.push({
      type: "verify_information",
      subjects: pendingOnlyNoGenuine,
      priority: "normal",
      text: `Restan registrar las calificaciones del período pendiente en ${formatSubjectList(pendingOnlyNoGenuine)}; cuando estén disponibles, se podrá completar la valoración académica del período.`,
    });
  }

  if (disapprovedSubjects.length >= config.globalRecoveryThreshold) {
    recommendations.push({
      type: "global_recovery_plan",
      subjects: unique(disapprovedSubjects),
      priority: "high",
      text:
        "Se recomienda organizar un plan de recuperación que contemple las materias con resultados desaprobados registrados, estableciendo prioridades y realizando un seguimiento periódico de los avances.",
    });
  }

  if (recommendations.length === 0 && summary.subjectsWithAnyDisapproval === 0) {
    recommendations.push({
      type: "sustain_progress",
      priority: "low",
      text:
        genuinelyIncompleteSubjects.length > 0
          ? "Se recomienda completar los registros faltantes para contar con una valoración integral."
          : pendingOnlySubjects.length > 0
            ? "No se identifican acciones de recuperación a partir de los registros disponibles del período cursado. Se recomienda continuar con el acompañamiento pedagógico habitual y completar la valoración cuando se registren las calificaciones del período pendiente."
            : "No se identifican acciones de recuperación a partir de los registros disponibles. Se recomienda continuar con el acompañamiento pedagógico habitual.",
    });
  }

  const generatedText = buildGeneratedText({
    analysis,
    persistentSubjects,
    positiveSubjects,
    recentSubjects,
    disapprovedSubjects,
    incompleteSubjects,
    genuinelyIncompleteSubjects,
    pendingOnlySubjects,
    approvedBothSubjects,
    recommendations,
    periods,
  });

  return {
    studentId: analysis.studentId,
    studentName: analysis.studentName,
    summary,
    situations,
    recommendations,
    generatedText,
  };
}

function buildGeneratedText(input: {
  analysis: StudentAnalysis;
  persistentSubjects: string[];
  positiveSubjects: string[];
  recentSubjects: string[];
  disapprovedSubjects: string[];
  incompleteSubjects: string[];
  genuinelyIncompleteSubjects: string[];
  pendingOnlySubjects: string[];
  approvedBothSubjects: string[];
  recommendations: Recommendation[];
  periods: { "1C": PeriodAvailability; "2C": PeriodAvailability };
}): GeneratedText {
  const {
    persistentSubjects,
    positiveSubjects,
    recentSubjects,
    disapprovedSubjects,
    genuinelyIncompleteSubjects,
    pendingOnlySubjects,
    recommendations,
    periods,
  } = input;
  const hasPending2C = periods["2C"] === "pending";
  const hasPending1C = periods["1C"] === "pending";

  // Situación académica
  const situationParts: string[] = [];
  if (disapprovedSubjects.length > 0) {
    if (persistentSubjects.length > 0 && persistentSubjects.length === disapprovedSubjects.length) {
      situationParts.push(
        `El alumno registra resultados desaprobados en ambos períodos en ${formatSubjectList(persistentSubjects)}.`,
      );
    } else if (persistentSubjects.length > 0) {
      situationParts.push(
        `El alumno registra resultados desaprobados en ${formatSubjectList(disapprovedSubjects)}.`,
      );
      situationParts.push(
        `En ${formatSubjectList(persistentSubjects)} se observan resultados desaprobados durante ambos períodos.`,
      );
    } else {
      situationParts.push(
        `El alumno registra resultados desaprobados en ${formatSubjectList(disapprovedSubjects)}.`,
      );
    }
  } else {
    situationParts.push(
      "En los registros disponibles no se identifican materias con resultados desaprobados.",
    );
  }

  if (genuinelyIncompleteSubjects.length > 0) {
    situationParts.push(
      `Se identifican registros académicos incompletos en ${formatSubjectList(genuinelyIncompleteSubjects)} que requieren verificación.`,
    );
  }
  if (pendingOnlySubjects.length > 0) {
    const pendingLabel =
      hasPending2C && !hasPending1C
        ? "del segundo período (aún sin calificaciones cargadas)"
        : hasPending1C && !hasPending2C
          ? "del primer período (aún sin calificaciones cargadas)"
          : "de los períodos pendientes";
    situationParts.push(
      `Restan registrar las calificaciones ${pendingLabel} en ${formatSubjectList(pendingOnlySubjects)}.`,
    );
  }
  if (disapprovedSubjects.length === 0 && genuinelyIncompleteSubjects.length > 0) {
    situationParts.push("Hay períodos sin información registrada que requieren verificación.");
  } else if (disapprovedSubjects.length === 0 && pendingOnlySubjects.length > 0 && genuinelyIncompleteSubjects.length === 0) {
    situationParts.push("No se registran observaciones adicionales sobre los resultados del período pendiente hasta contar con sus calificaciones.");
  }

  const academicSituation = situationParts.join(" ").replace(/\s+/g, " ").trim() || "No hay información suficiente para elaborar una valoración académica.";

  // Evolución
  const evolutionParts: string[] = [];
  if (persistentSubjects.length > 0) {
    evolutionParts.push(
      persistentSubjects.length === 1
        ? `Se mantienen resultados desaprobados en ambos períodos en ${persistentSubjects[0]}.`
        : `Se mantienen resultados desaprobados en ambos períodos en ${formatSubjectList(persistentSubjects)}.`,
    );
  }
  if (positiveSubjects.length > 0) {
    evolutionParts.push(
      positiveSubjects.length === 1
        ? `Se identifica una evolución favorable en ${positiveSubjects[0]}, con resultado desaprobado en el primer período y aprobado en el segundo.`
        : `Se identifica una evolución favorable en ${formatSubjectList(positiveSubjects)}, con resultados desaprobados en el primer período y aprobados en el segundo.`,
    );
  }
  if (recentSubjects.length > 0) {
    evolutionParts.push(
      recentSubjects.length === 1
        ? `En ${recentSubjects[0]} se registra un resultado aprobado durante el primer período y desaprobado durante el segundo.`
        : `En ${formatSubjectList(recentSubjects)} se registran resultados aprobados durante el primer período y desaprobados durante el segundo.`,
    );
  }
  if (evolutionParts.length === 0) {
    if (hasPending2C && !hasPending1C) {
      evolutionParts.push(
        "Aún no es posible analizar la evolución entre períodos porque las calificaciones del segundo período no están registradas.",
      );
    } else if (hasPending1C && !hasPending2C) {
      evolutionParts.push(
        "Aún no es posible analizar la evolución entre períodos porque las calificaciones del primer período no están registradas.",
      );
    } else if (genuinelyIncompleteSubjects.length > 0) {
      evolutionParts.push("La información disponible es parcial; no es posible describir completamente la evolución entre períodos.");
    } else if (disapprovedSubjects.length === 0) {
      evolutionParts.push("No se registran cambios asociados a resultados desaprobados entre períodos en los datos disponibles.");
    } else {
      evolutionParts.push("No se identifican otros cambios entre períodos en los registros disponibles.");
    }
  }

  const evolution = evolutionParts.join(" ").replace(/\s+/g, " ").trim();

  // Recomendaciones
  const recTexts = recommendations.map((r) => r.text.trim()).filter(Boolean);
  const recommendationsText = recTexts.join("\n\n") || "No se registran recomendaciones específicas a partir de la información disponible.";

  return {
    academicSituation,
    evolution,
    recommendations: recommendationsText,
  };
}

export function generateObservationsForDataset(
  analyses: StudentAnalysis[],
  config: ObservationConfig = defaultObservationConfig,
): ObservationResult[] {
  return analyses.map((a) => generateObservation(a, config));
}

export function detectDatasetPeriodAvailability(dataset: {
  subjects: string[];
  students: Array<{ subjects: Record<string, { "1C": "A" | "X" | null; "2C": "A" | "X" | null }> }>;
  mapping: { subjectColumns: Record<string, { "1C": number | null; "2C": number | null }> };
}): { "1C": PeriodAvailability; "2C": PeriodAvailability } {
  const hasData = (period: "1C" | "2C") => {
    for (const subj of dataset.subjects) {
      const mapped = dataset.mapping.subjectColumns[subj]?.[period];
      // si no está mapeada la columna, no contamos como "datos disponibles" por esa materia,
      // pero puede haber otras materias con el período; verificamos valores reales.
      for (const st of dataset.students) {
        const v = st.subjects[subj]?.[period];
        if (v === "A" || v === "X") return true;
      }
      // si hay columna mapeada, podría haber datos vacíos pero el período "existe" en planilla;
      // sin embargo, sin A/X no podemos afirmar resultados. Lo tratamos como sin datos cargados.
      void mapped;
    }
    return false;
  };

  return {
    "1C": hasData("1C") ? "available" : "pending",
    "2C": hasData("2C") ? "available" : "pending",
  };
}
