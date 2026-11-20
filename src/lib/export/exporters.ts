import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { NormalizedDataset } from "@/types/academic";
import type { StudentAnalysis } from "@/types/analysis";
import type { GeneratedText, ObservationResult } from "@/types/observations";
import type { CourseAggregations } from "@/lib/analysis/aggregations";

export type ExportOptions = {
  /** Incluir nombres de alumnos en la exportación. Por defecto false (anonimizado). El DNI nunca se incluye. */
  includeNames?: boolean;
};

function formatObservationText(text: GeneratedText): string {
  return `Situación académica\n${text.academicSituation}\n\nEvolución\n${text.evolution}\n\nRecomendaciones\n${text.recommendations}`;
}

export function studentExportLabel(analysis: StudentAnalysis, index: number, includeNames: boolean): string {
  if (includeNames) {
    return analysis.studentNumber ? `${analysis.studentNumber}. ${analysis.studentName}` : analysis.studentName;
  }
  return analysis.studentNumber ? `Alumno ${analysis.studentNumber}` : `Alumno ${index + 1}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportIndividualText(
  dataset: NormalizedDataset,
  analysis: StudentAnalysis,
  text: GeneratedText,
  options?: ExportOptions,
  index = 0,
) {
  const includeNames = options?.includeNames ?? false;
  const label = studentExportLabel(analysis, index, includeNames);
  const header = [
    `Alumno: ${label}`,
    `Archivo: ${dataset.context.fileName}`,
    `Hoja: ${dataset.context.sheetName}`,
    dataset.context.year ? `Año lectivo: ${dataset.context.year}` : null,
    dataset.context.course ? `Curso: ${dataset.context.course}` : null,
    dataset.context.division ? `División: ${dataset.context.division}` : null,
    "",
  ]
    .filter(Boolean)
    .join("\n");
  const content = `${header}\n${formatObservationText(text)}\n`;
  downloadBlob(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
    `observacion-${sanitizeFilename(label)}.txt`,
  );
}

export function exportIndividualPdf(
  dataset: NormalizedDataset,
  analysis: StudentAnalysis,
  observation: ObservationResult,
  text: GeneratedText,
  options?: ExportOptions,
  index = 0,
) {
  const includeNames = options?.includeNames ?? false;
  const label = studentExportLabel(analysis, index, includeNames);
  const doc = new jsPDF();
  let y = 14;
  doc.setFontSize(14);
  doc.text("Informe individual - Observación pedagógica", 14, y);
  y += 8;
  doc.setFontSize(10);
  const meta = [
    `Alumno: ${label}`,
    `Archivo: ${dataset.context.fileName}`,
    `Hoja: ${dataset.context.sheetName}`,
  ].join(" | ");
  doc.text(meta, 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Resultados aprobados (registros)", String(analysis.summary.approved)],
      ["Resultados desaprobados (registros)", String(analysis.summary.disapproved)],
      ["Registros sin información", String(analysis.summary.missing)],
      ["Materias con algún X", String(analysis.summary.subjectsWithAnyDisapproval)],
      ["Materias con X en ambos períodos", String(analysis.summary.subjectsWithPersistentDifficulty)],
      ["Materias con evolución favorable", String(analysis.summary.subjectsWithPositiveEvolution)],
      ["Materias con información incompleta", String(analysis.summary.subjectsWithIncompleteInformation)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  const sections: [string, string][] = [
    ["Situación académica", text.academicSituation],
    ["Evolución", text.evolution],
    ["Recomendaciones", text.recommendations],
  ];
  for (const [title, body] of sections) {
    if (y > 270) { doc.addPage(); y = 14; }
    doc.setFontSize(11);
    doc.text(title, 14, y);
    y += 5;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body || "-", 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }

  if (observation.situations.length > 0) {
    if (y > 250) { doc.addPage(); y = 14; }
    doc.setFontSize(11);
    doc.text("Situaciones detectadas", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Situación", "Materia", "Prioridad"]],
      body: observation.situations.map((s) => [s.description, s.subject ?? "-", s.priority]),
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [51, 65, 85] },
    });
  }

  doc.save(`informe-${sanitizeFilename(label)}.pdf`);
}

export function exportGeneralReportPdf(
  dataset: NormalizedDataset,
  analyses: StudentAnalysis[],
  observations: ObservationResult[],
  aggregations: CourseAggregations,
  options?: ExportOptions,
) {
  const includeNames = options?.includeNames ?? false;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Informe general del curso", 14, 14);
  doc.setFontSize(10);
  doc.text(`Archivo: ${dataset.context.fileName} | Hoja: ${dataset.context.sheetName}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [["Indicador", "Cantidad"]],
    body: [
      ["Alumnos", String(aggregations.totalStudents)],
      ["Requieren atención", String(aggregations.counts.requiresAttention)],
      ["Atención prioritaria", String(aggregations.counts.priorityAttention)],
      ["Evolución favorable", String(aggregations.counts.positiveEvolution)],
      ["Dificultad reciente", String(aggregations.counts.recentDifficulty)],
      ["Información incompleta", String(aggregations.counts.incompleteInformation)],
      ["Sin desaprobaciones registradas", String(aggregations.counts.noDisapprovalsRecorded)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable
  let y = (doc.lastAutoTable?.finalY ?? 26) + 8;
  doc.setFontSize(11);
  doc.text("Materias con mayor cantidad de situaciones", 14, y);
  y += 4;
  const topSubjects = [...aggregations.situationsBySubject].sort((a, b) => b.count - a.count).slice(0, 15);
  autoTable(doc, {
    startY: y,
    head: [["Materia", "Cantidad de situaciones"]],
    body: topSubjects.map((s) => [s.subject, String(s.count)]),
    theme: "striped",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [51, 65, 85] },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  if (y > 260) { doc.addPage(); y = 14; }
  doc.setFontSize(11);
  doc.text("Observaciones generales (resumen por alumno)", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Alumno", "X (reg.)", "X ambos", "Evol. fav.", "Incompletos", "Estado"]],
    body: analyses.map((a, idx) => [
      studentExportLabel(a, idx, includeNames),
      String(a.summary.disapproved),
      String(a.summary.subjectsWithPersistentDifficulty),
      String(a.summary.subjectsWithPositiveEvolution),
      String(a.summary.subjectsWithIncompleteInformation),
      a.categories.join(", "),
    ]),
    theme: "striped",
    styles: { fontSize: 7 },
    headStyles: { fillColor: [51, 65, 85] },
  });

  doc.save(`informe-general-${sanitizeFilename(dataset.context.sheetName)}.pdf`);
}

export function exportProcessedResultsExcel(
  dataset: NormalizedDataset,
  analyses: StudentAnalysis[],
  observations: ObservationResult[],
  options?: ExportOptions,
) {
  const includeNames = options?.includeNames ?? false;
  const wb = XLSX.utils.book_new();

  const studentsRows = analyses.map((a, idx) => {
    const obs = observations.find((o) => o.studentId === a.studentId);
    return {
      Numero: a.studentNumber ?? "",
      Alumno: studentExportLabel(a, idx, includeNames),
      Aprobados_registros: a.summary.approved,
      Desaprobados_registros: a.summary.disapproved,
      Sin_informacion_registros: a.summary.missing,
      Materias_con_X: a.summary.subjectsWithAnyDisapproval,
      Materias_X_ambos_periodos: a.summary.subjectsWithPersistentDifficulty,
      Materias_evolucion_favorable: a.summary.subjectsWithPositiveEvolution,
      Materias_dificultad_reciente: a.summary.subjectsWithRecentDifficulty,
      Materias_incompletas: a.summary.subjectsWithIncompleteInformation,
      Categorias: a.categories.join(" | "),
      Situacion_academica: obs?.generatedText.academicSituation ?? "",
      Evolucion: obs?.generatedText.evolution ?? "",
      Recomendaciones: obs?.generatedText.recommendations ?? "",
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsRows), "Alumnos");

  const detailRows: Record<string, string | number | null>[] = [];
  analyses.forEach((a, idx) => {
    const label = studentExportLabel(a, idx, includeNames);
    for (const s of a.subjects) {
      detailRows.push({
        Alumno: label,
        Materia: s.subject,
        "1C": s.grades["1C"],
        "2C": s.grades["2C"],
        Tiene_desaprobacion: s.hasDisapproval ? "Sí" : "No",
        Dificultad_persistente: s.isPersistentDifficulty ? "Sí" : "No",
        Evolucion_favorable: s.isPositiveEvolution ? "Sí" : "No",
        Dificultad_reciente: s.isRecentDifficulty ? "Sí" : "No",
        Incompleto: s.isIncomplete ? "Sí" : "No",
      });
    }
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Detalle_materias");

  XLSX.writeFile(wb, `resultados-procesados-${sanitizeFilename(dataset.context.sheetName)}.xlsx`);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\- áéíóúÁÉÍÓÚñÑ]/g, "").trim().replace(/\s+/g, "_") || "archivo";
}
