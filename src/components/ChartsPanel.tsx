"use client";

import { useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NormalizedDataset } from "@/types/academic";
import type { StudentAnalysis, SubjectAnalysis } from "@/types/analysis";
import type { ObservationResult } from "@/types/observations";
import {
  aggregateCourseData,
  getDisapprovalsByPeriod,
  getObservationMetrics,
  getStudentsByDisapprovedSubjects,
  type DisapprovedStudentRow,
  type ObservationMetrics,
} from "@/lib/analysis/aggregations";

const COLORS = ["#1d4ed8", "#dc2626", "#059669", "#d97706", "#0284c7", "#7c3aed", "#475569"];

type PeriodView = "both" | "1C" | "2C";

const periodLabels: Record<PeriodView, string> = {
  both: "Ambos períodos",
  "1C": "1.º cuatrimestre",
  "2C": "2.º cuatrimestre",
};

const chartHelp = {
  attention: "Cuenta alumnos, no materias. Un mismo alumno puede aparecer en más de un grupo.",
  situations: "Cada cuenta es un par alumno–materia con X o sin dato; por eso puede superar el total de alumnos.",
  recommendations: "Un alumno puede tener varias recomendaciones a la vez, así que la suma puede ser mayor que el total de alumnos.",
  persistent: "Cuenta alumnos por materia que desaprobaron en 1C y en 2C. Una misma materia puede repetirse para varios alumnos.",
  periodComparison: "Cuenta resultados (alumno × materia), no alumnos: cada alumno aporta una celda por materia y período.",
  pending: "Ejemplo: si la barra del 3 marca 2 alumnos, esos 2 alumnos tienen 3 materias con X en el período elegido.",
  disapprovalsByPeriod: "Izquierda: resultados X sobre los resultados evaluados. Derecha: alumnos con al menos una X sobre el total de alumnos.",
  observation: "Se lee la columna “Observaciones” y reconoce abreviaturas como “Biol.” o “P.D.Leng.”. No es una nota: lo que no coincide va a “Sin clasificar”.",
  disapprovalShare: "Cuenta alumnos, no materias: un alumno con 6 desaprobadas entra una sola vez en “Con desaprobaciones”.",
};

function ChartCard({
  title,
  description,
  help,
  note,
  heightClass = "h-72",
  children,
}: {
  title: string;
  description?: string;
  help?: string;
  note?: string;
  heightClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      {help && (
        <p className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-xs leading-5 text-slate-600 ring-1 ring-inset ring-slate-200">
          {help}
        </p>
      )}
      {note && <p className="mt-1 text-xs text-amber-800">{note}</p>}
      <div className={`mt-3 w-full min-w-0 overflow-hidden ${heightClass}`}>{children}</div>
    </section>
  );
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function labeledCount(count: number, percentage: number): string {
  return `${count} (${formatPercent(percentage)})`;
}

function studentDisplayLabel(
  a: { studentName: string; studentNumber: string | null },
  idx: number,
  hideNames: boolean,
): string {
  if (hideNames) {
    return a.studentNumber ? `Alumno ${a.studentNumber}` : `Alumno ${idx + 1}`;
  }
  return a.studentNumber ? `${a.studentNumber}. ${a.studentName}` : a.studentName;
}

function StudentCountTable({
  title,
  rows,
  hideNames,
}: {
  title: string;
  rows: DisapprovedStudentRow[];
  hideNames: boolean;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-slate-900">{title}</h5>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
          {rows.length} alumnos
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Sin alumnos en este grupo.</p>
      ) : (
        <div className="table-scrollbar mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-r border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Alumno</th>
                <th className="border-b border-slate-300 px-3 py-2 text-right font-semibold text-slate-900">Materias desaprobadas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.studentId} className="odd:bg-white even:bg-slate-50">
                  <th scope="row" className="border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-900 whitespace-nowrap">
                    {studentDisplayLabel(row, idx, hideNames)}
                  </th>
                  <td className="border-b border-slate-200 px-3 py-2 text-right tabular-nums text-slate-800">
                    {row.disapprovedSubjects}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ObservationStudentsTable({
  metrics,
  hideNames,
}: {
  metrics: ObservationMetrics;
  hideNames: boolean;
}) {
  const rows = metrics.rows.filter((row) => row.subjects.length > 0 || row.unmatched.length > 0);

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-semibold text-slate-900">Materias en observación por alumno</h5>
          <p className="mt-1 text-xs text-slate-600">
            Tomado del texto original de la planilla; no se interpreta como resultado aprobado ni desaprobado.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
          {metrics.studentsWithObservations} alumnos
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No hay observaciones originales cargadas.</p>
      ) : (
        <div className="table-scrollbar mt-3 max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-r border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Alumno</th>
                <th className="border-b border-r border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Materias en observación</th>
                <th className="border-b border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Sin clasificar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.studentId} className="odd:bg-white even:bg-slate-50">
                  <th scope="row" className="border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-900 whitespace-nowrap">
                    {studentDisplayLabel(row, idx, hideNames)}
                  </th>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-800">
                    {row.subjects.length > 0 ? row.subjects.join(", ") : "—"}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-slate-600">
                    {row.unmatched.length > 0 ? row.unmatched.join("; ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function subjectSituationDetailsBoth(s: SubjectAnalysis): string[] {
  const details: string[] = [];
  if (s.isPersistentDifficulty) details.push("Dificultad persistente (X en 1C y 2C)");
  if (s.isPositiveEvolution) details.push("Evolución favorable (X en 1C y A en 2C)");
  if (s.isRecentDifficulty) details.push("Dificultad reciente (A en 1C y X en 2C)");
  if (s.hasDisapproval && !s.isPersistentDifficulty && !s.isPositiveEvolution && !s.isRecentDifficulty) {
    details.push("Desaprobación registrada");
  }
  if (s.isApprovedBoth) details.push("Aprobación en ambos períodos (A en 1C y 2C)");
  if (s.isIncomplete) {
    const periods = s.missingPeriods.join(" y ");
    details.push(`Información incompleta (sin dato en ${periods || "uno o más períodos"})`);
  }
  if (details.length === 0) details.push("Sin situaciones detectadas");
  return details;
}

function subjectSituationDetailsSingle(s: SubjectAnalysis, period: "1C" | "2C"): string[] {
  const g = s.grades[period];
  if (g === "X") return [`Desaprobado (X) en ${period}`];
  if (g === "A") return [`Aprobado (A) en ${period}`];
  return [`Sin información en ${period}`];
}

export function ChartsPanel({
  dataset,
  analyses,
  observations,
}: {
  dataset: NormalizedDataset;
  analyses: StudentAnalysis[];
  observations: ObservationResult[];
}) {
  const agg = aggregateCourseData(dataset, analyses, observations);
  const [hideNames, setHideNames] = useState(false);
  const [periodView, setPeriodView] = useState<PeriodView>("both");
  const toggleId = useId();

  const noData = analyses.length === 0;

  const periodData = useMemo(() => {
    if (periodView === "both") {
      const attentionData = [
        { name: "Requieren atención", value: agg.counts.requiresAttention },
        { name: "Atención prioritaria", value: agg.counts.priorityAttention },
        { name: "Evolución favorable", value: agg.counts.positiveEvolution },
        { name: "Dificultad reciente", value: agg.counts.recentDifficulty },
        { name: "Información incompleta", value: agg.counts.incompleteInformation },
        { name: "Sin desaprobaciones", value: agg.counts.noDisapprovalsRecorded },
      ].filter((d) => d.value > 0);

      const situationsBySubject = agg.situationsBySubject;
      const persistentBySubject = agg.persistentDifficultiesBySubject;
      const recommendationsByType = agg.recommendationsByType;
      const periodComparison = agg.periodComparison;

      const pendingDist = [...agg.pendingSubjectsDistribution];

      const matrixLegend = [
        { v: 0, label: "Sin situación", color: "#e2e8f0" },
        { v: 1, label: "Desaprobación", color: "#f59e0b" },
        { v: 2, label: "Persistente (X ambos)", color: "#dc2626" },
        { v: 3, label: "Evolución favorable", color: "#059669" },
        { v: 4, label: "Dificultad reciente", color: "#d97706" },
        { v: 5, label: "Info. incompleta", color: "#0284c7" },
      ];

      const matrixCells = agg.matrix.cells;

      return {
        attentionData,
        situationsBySubject,
        persistentBySubject,
        recommendationsByType,
        periodComparison,
        pendingDist,
        matrixLegend,
        matrixCells,
        recommendationsNote: undefined as string | undefined,
        persistentNote: undefined as string | undefined,
      };
    }

    const p = periodView; // "1C" | "2C"
    let requires = 0, incomplete = 0, none = 0;
    const situationMap = new Map<string, number>();
    const pendingCountMap = new Map<number, number>();
    let pA = 0, pX = 0, pM = 0;

    const matrixCells = analyses.map((a) => {
      let hasX = false;
      let hasMissing = false;
      let pendingSubjects = 0;
      const row: number[] = [];
      for (const s of a.subjects) {
        const g = s.grades[p];
        if (g === "A") { pA++; row.push(2); }
        else if (g === "X") { pX++; hasX = true; pendingSubjects++; situationMap.set(s.subject, (situationMap.get(s.subject) ?? 0) + 1); row.push(1); }
        else { pM++; hasMissing = true; situationMap.set(s.subject, (situationMap.get(s.subject) ?? 0) + 1); row.push(0); }
      }
      if (hasX) requires++;
      if (hasMissing) incomplete++;
      if (!hasX) none++;
      pendingCountMap.set(pendingSubjects, (pendingCountMap.get(pendingSubjects) ?? 0) + 1);
      return row;
    });

    const attentionData = [
      { name: "Requieren atención (con X)", value: requires },
      { name: "Información incompleta", value: incomplete },
      { name: "Sin desaprobaciones", value: none },
    ].filter((d) => d.value > 0);

    const situationsBySubject = dataset.subjects.map((subject) => ({
      subject,
      count: situationMap.get(subject) ?? 0,
    }));

    const maxPending = Math.max(0, ...Array.from(pendingCountMap.keys()));
    const pendingDist: { pendingCount: number; students: number }[] = [];
    for (let i = 0; i <= maxPending; i++) {
      pendingDist.push({ pendingCount: i, students: pendingCountMap.get(i) ?? 0 });
    }

    const recMap = new Map<string, number>();
    for (const a of analyses) {
      let hasAnyX = false;
      let hasAnyMissing = false;
      let allA = true;
      for (const s of a.subjects) {
        const g = s.grades[p];
        if (g === "X") { hasAnyX = true; allA = false; }
        else if (g === null) { hasAnyMissing = true; allA = false; }
      }
      if (hasAnyX) recMap.set("recovery", (recMap.get("recovery") ?? 0) + 1);
      if (hasAnyMissing) recMap.set("verify_information", (recMap.get("verify_information") ?? 0) + 1);
      if (!hasAnyX && !hasAnyMissing && allA) recMap.set("sustain_progress", (recMap.get("sustain_progress") ?? 0) + 1);
    }
    const recLabels: Record<string, string> = {
      recovery: "Recuperación / refuerzo",
      verify_information: "Verificar información",
      sustain_progress: "Sostener acompañamiento",
    };
    const recommendationsByType = Array.from(recMap.entries()).map(([type, count]) => ({
      type,
      label: recLabels[type] ?? type,
      count,
    }));

    const matrixLegend = [
      { v: 0, label: "Sin información", color: "#94a3b8" },
      { v: 1, label: "Desaprobado (X)", color: "#dc2626" },
      { v: 2, label: "Aprobado (A)", color: "#059669" },
    ];

    const periodName = p === "1C" ? "1.º cuatrimestre" : "2.º cuatrimestre";

    return {
      attentionData,
      situationsBySubject,
      persistentBySubject: dataset.subjects.map((subject) => ({ subject, count: 0 })),
      recommendationsByType,
      periodComparison: [{ period: p, approved: pA, disapproved: pX, missing: pM }],
      pendingDist,
      matrixLegend,
      matrixCells,
      recommendationsNote: `Estimación según resultados del ${periodName} (las recomendaciones pedagógicas completas se generan con la vista de ambos períodos).`,
      persistentNote: "Las dificultades persistentes requieren comparar ambos períodos.",
    };
  }, [periodView, agg, analyses, dataset.subjects]);

  const disapprovalsByPeriod = useMemo(() => getDisapprovalsByPeriod(analyses), [analyses]);
  const observationMetrics = useMemo(() => getObservationMetrics(dataset), [dataset]);
  const disapprovalBuckets = useMemo(
    () => getStudentsByDisapprovedSubjects(analyses, periodView),
    [analyses, periodView],
  );

  const topSituations = periodData.situationsBySubject.filter((d) => d.count > 0).slice(0, 12);
  const topPersistent = periodData.persistentBySubject.filter((d) => d.count > 0).slice(0, 12);
  const topPending = periodData.pendingDist.filter((entry) => entry.students > 0).slice(0, 11);

  const disapprovedResultsData = disapprovalsByPeriod.map((metric) => ({
    period: metric.period === "1C" ? "1.º cuatrimestre" : "2.º cuatrimestre",
    value: metric.disapprovedResults,
    label: labeledCount(metric.disapprovedResults, metric.disapprovedPercentage),
  }));
  const studentsWithDisapprovalData = disapprovalsByPeriod.map((metric) => ({
    period: metric.period === "1C" ? "1.º cuatrimestre" : "2.º cuatrimestre",
    value: metric.studentsWithDisapproval,
    label: labeledCount(metric.studentsWithDisapproval, metric.studentsPercentage),
  }));
  const observationSubjectData = observationMetrics.bySubject.slice(0, 12).map((entry) => ({
    subject: entry.subject,
    students: entry.students,
    label: labeledCount(entry.students, entry.percentage),
  }));
  const withoutDisapproval = disapprovalBuckets.totalStudents - disapprovalBuckets.withAny;
  const disapprovalShareData = [
    {
      name: "Con desaprobaciones",
      students: disapprovalBuckets.withAny,
      label: labeledCount(disapprovalBuckets.withAny, disapprovalBuckets.withAnyPercentage),
    },
    {
      name: "Sin desaprobaciones",
      students: withoutDisapproval,
      label: labeledCount(withoutDisapproval, disapprovalBuckets.withoutPercentage),
    },
  ];

  const situationsDescription =
    periodView === "both"
      ? "Materias con más situaciones (desaprobaciones, evoluciones, información incompleta)."
      : `Situaciones registradas en el ${periodLabels[periodView]} (desaprobaciones e información incompleta).`;

  const attentionDescription =
    periodView === "both"
      ? "Distribución de alumnos según las categorías detectadas (un alumno puede pertenecer a más de una)."
      : `Distribución de alumnos según lo registrado en el ${periodLabels[periodView]} (un alumno puede pertenecer a más de una categoría).`;

  const pendingDescription =
    periodView === "both"
      ? "Cantidad de alumnos según cuántas materias tienen al menos un X."
      : `Cantidad de alumnos según cuántas materias tienen X en el ${periodLabels[periodView]}.`;

  const periodComparisonDescription =
    periodView === "both"
      ? "Registros aprobados, desaprobados y sin información en 1C vs 2C."
      : `Registros aprobados, desaprobados y sin información en el ${periodLabels[periodView]}.`;

  const matrixDescription =
    periodView === "both"
      ? "Vista local con nombres de alumnos por defecto (sin DNI). El color indica la situación principal; pasá el cursor por una celda para ver todas las situaciones de esa materia. Activá “Anonimizar nombres” antes de proyectar o compartir la pantalla."
      : `Vista del ${periodLabels[periodView]} (sin DNI). El color indica el resultado registrado en ese período. Activá “Anonimizar nombres” antes de proyectar o compartir la pantalla.`;

  return (
    <section className="min-w-0 space-y-4" aria-labelledby={`charts-${dataset.id}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 id={`charts-${dataset.id}`} className="text-xl font-semibold text-slate-900">
            Visualizaciones
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Gráficos basados en los datos analizados de esta planilla. No incluyen DNI.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Período analizado</span>
          <div className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-slate-100 p-1" role="group" aria-label="Período analizado">
            {(["both", "1C", "2C"] as const).map((value) => {
              const active = periodView === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPeriodView(value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                    active
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  {value === "both" ? "Ambos" : value === "1C" ? "Solo 1C" : "Solo 2C"}
                </button>
              );
            })}
          </div>
          {periodView !== "both" && (
            <p className="text-xs text-slate-600 max-w-xs">
              Útil cuando el 2.º cuatrimestre aún no tiene datos cargados.
            </p>
          )}
        </div>
      </div>

      {noData ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">No hay datos suficientes para generar gráficos.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="1. Alumnos por categoría de atención" description={attentionDescription} help={chartHelp.attention}>
            {periodData.attentionData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={periodData.attentionData} dataKey="value" nameKey="name" outerRadius={95} label>
                    {periodData.attentionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="4. Cantidad de situaciones detectadas por materia" description={situationsDescription} help={chartHelp.situations}>
            {topSituations.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSituations} layout="vertical" margin={{ left: 20, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="subject" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Situaciones" fill="#1d4ed8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="5. Distribución de recomendaciones por tipo"
            description="Cantidad de alumnos para los que se identifica cada recomendación."
            help={chartHelp.recommendations}
            note={periodData.recommendationsNote}
          >
            {periodData.recommendationsByType.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodData.recommendationsByType} margin={{ left: 10, right: 10, top: 5, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Alumnos" fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="6. Materias con mayor cantidad de dificultades persistentes"
            description="Materias con X en ambos períodos (1C y 2C)."
            help={chartHelp.persistent}
            note={periodData.persistentNote}
          >
            {periodView !== "both" ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-600">
                Seleccioná “Ambos” para ver las dificultades persistentes (requieren comparar 1C y 2C).
              </div>
            ) : topPersistent.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPersistent} layout="vertical" margin={{ left: 20, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="subject" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Alumnos" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="7. Comparación de situaciones entre períodos"
            description={periodComparisonDescription}
            help={chartHelp.periodComparison}
            heightClass="h-96"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData.periodComparison} margin={{ top: 28, right: 12, left: 0, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" padding={{ left: 12, right: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" name="Aprobados (A)" fill="#059669" />
                <Bar dataKey="disapproved" name="Desaprobados (X)" fill="#dc2626" />
                <Bar dataKey="missing" name="Sin información" fill="#64748b" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="10. Alumnos según cantidad de materias desaprobadas"
            description={pendingDescription}
            help={chartHelp.pending}
            heightClass="h-96"
          >
            {topPending.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPending} margin={{ top: 28, right: 12, left: 0, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="pendingCount"
                    padding={{ left: 12, right: 12 }}
                    label={{ value: "Materias con X", position: "bottom", offset: 4 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="students" name="Alumnos" fill="#7c3aed">
                    <LabelList dataKey="students" position="top" fontSize={10} fill="#334155" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="11. Desaprobaciones por cuatrimestre"
            description="Resultados desaprobados y alumnos con al menos una desaprobación en 1C y 2C. El número y el porcentaje se muestran sobre cada barra."
            help={chartHelp.disapprovalsByPeriod}
            note="Este gráfico siempre compara ambos cuatrimestres, independientemente del período seleccionado."
          >
            <div className="grid h-full gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Resultados desaprobados</p>
                <div className="h-[calc(100%-1.25rem)] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={disapprovedResultsData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax * 1.25)]} />
                      <Tooltip />
                      <Bar dataKey="value" name="Resultados X" fill="#dc2626">
                        <LabelList dataKey="label" position="top" fontSize={10} fill="#334155" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Alumnos con desaprobaciones</p>
                <div className="h-[calc(100%-1.25rem)] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={studentsWithDisapprovalData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax * 1.25)]} />
                      <Tooltip />
                      <Bar dataKey="value" name="Alumnos" fill="#d97706">
                        <LabelList dataKey="label" position="top" fontSize={10} fill="#334155" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title="12. Materias en observación según la planilla"
            description="Alumnos que tienen cada materia en el texto de observaciones original, con número y porcentaje sobre el total del curso."
            help={chartHelp.observation}
            note="El texto original no distingue cuatrimestres y no se interpreta como resultado académico."
          >
            {observationSubjectData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={observationSubjectData} layout="vertical" margin={{ left: 20, right: 90, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax * 1.3)]} />
                  <YAxis type="category" dataKey="subject" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="students" name="Alumnos" fill="#0284c7">
                    <LabelList dataKey="label" position="right" fontSize={10} fill="#334155" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="13. Porcentaje de alumnos con materias desaprobadas"
            description={periodView === "both"
              ? "Alumnos con al menos una materia desaprobada en el año vs. alumnos sin desaprobaciones."
              : `Alumnos con al menos una materia desaprobada en el ${periodLabels[periodView]} vs. alumnos sin desaprobaciones.`}
            help={chartHelp.disapprovalShare}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disapprovalShareData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax * 1.25)]} />
                <Tooltip />
                <Bar dataKey="students" name="Alumnos">
                  {disapprovalShareData.map((entry, idx) => (
                    <Cell key={entry.name} fill={idx === 0 ? "#dc2626" : "#059669"} />
                  ))}
                  <LabelList dataKey="label" position="top" fontSize={11} fill="#334155" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {!noData && (
        <section className="mt-4 space-y-4" aria-label="Detalle de observaciones y desaprobaciones">
          <ObservationStudentsTable metrics={observationMetrics} hideNames={hideNames} />

          <div className="space-y-2">
            <div>
              <h4 className="text-base font-semibold text-slate-900">13. Alumnos según cantidad de materias desaprobadas</h4>
              <p className="mt-1 text-sm text-slate-600">
                Las tablas respetan el período seleccionado y la opción “Anonimizar nombres” de la matriz. No incluyen DNI.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <StudentCountTable title="5 o más materias desaprobadas" rows={disapprovalBuckets.fiveOrMore} hideNames={hideNames} />
              <StudentCountTable title="Menos de 5 materias desaprobadas (1 a 4)" rows={disapprovalBuckets.oneToFour} hideNames={hideNames} />
              <StudentCountTable title="Sin materias desaprobadas" rows={disapprovalBuckets.none} hideNames={hideNames} />
            </div>
          </div>
        </section>
      )}

      <section className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-900">9. Matriz de alumnos y materias con situaciones detectadas</h4>
            <p className="mt-1 text-sm text-slate-600">{matrixDescription}</p>
          </div>
          <label htmlFor={toggleId} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
            <input
              id={toggleId}
              type="checkbox"
              checked={hideNames}
              onChange={(e) => setHideNames(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
            />
            Anonimizar nombres
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {periodData.matrixLegend.map((l) => (
            <span key={l.v} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-slate-800">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
        <div className="table-scrollbar mt-3 max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-max border-collapse text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold text-slate-900">Alumno</th>
                {agg.matrix.subjects.map((subj) => (
                  <th key={subj} className="sticky top-0 z-10 border-b border-l border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">{subj}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyses.map((a, r) => {
                const label = studentDisplayLabel(a, r, hideNames);
                return (
                  <tr key={a.studentId} className="odd:bg-white even:bg-slate-50">
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-2 py-2 text-left font-medium text-slate-900 whitespace-nowrap">{label}</th>
                    {periodData.matrixCells[r].map((v, c) => {
                      const leg = periodData.matrixLegend.find((l) => l.v === v) ?? periodData.matrixLegend[0];
                      const subjAnalysis = a.subjects[c];
                      const details =
                        periodView === "both"
                          ? subjAnalysis ? subjectSituationDetailsBoth(subjAnalysis) : [leg.label]
                          : subjAnalysis ? subjectSituationDetailsSingle(subjAnalysis, periodView) : [leg.label];
                      const title = `${label} — ${agg.matrix.subjects[c]}: ${details.join("; ")}`;
                      return (
                        <td key={c} className="border-b border-l border-slate-200 px-2 py-2 text-center" title={title}>
                          <span className="inline-block h-4 w-4 rounded-sm ring-1 ring-inset ring-slate-300/60" style={{ backgroundColor: leg.color }} aria-label={title} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-sm text-slate-600">
        Nota: los gráficos 2 (dificultades persistentes) y 3 (evolución favorable) se reflejan en los conteos del gráfico 1 y en la matriz. Los gráficos 11 a 13 muestran desaprobaciones por cuatrimestre, materias en observación originales y porcentaje de alumnos con desaprobaciones, con número y porcentaje. El gráfico 8 (comparación histórica entre años) requiere datos de distintos años lectivos identificados y comparables (Fase 6).
      </p>
    </section>
  );
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">Sin datos para mostrar.</div>;
}
