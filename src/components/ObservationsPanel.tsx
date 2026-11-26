"use client";

import { useMemo, useState } from "react";
import type { NormalizedDataset } from "@/types/academic";
import type { StudentAnalysis } from "@/types/analysis";
import type { DetectedSituation, GeneratedText, ObservationResult } from "@/types/observations";
import { exportIndividualPdf, exportIndividualText, studentExportLabel } from "@/lib/export/exporters";

type FilterKey =
  | "all"
  | "requires_attention"
  | "priority_attention"
  | "positive_evolution"
  | "incomplete_information"
  | "no_disapprovals_recorded";

interface EditEntry {
  text: GeneratedText;
  isEdited: boolean;
  baseAutoKey: string;
}

function buildAutoKey(obs: ObservationResult): string {
  return JSON.stringify({
    summary: obs.summary,
    situations: obs.situations.map((s) => [s.type, s.subject ?? "", (s.periods ?? []).join(",")]),
    text: obs.generatedText,
  });
}

function formatObservationText(text: GeneratedText): string {
  return `Situación académica\n${text.academicSituation}\n\nEvolución\n${text.evolution}\n\nRecomendaciones\n${text.recommendations}`;
}

function fixMojibake(str: string): string {
  if (!/[ÃÂ]/.test(str)) return str;
  try {
    const bytes = Uint8Array.from(Array.from(str).map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    if (decoded && decoded !== str && !/\uFFFD/.test(decoded)) return decoded;
  } catch {
    // ignore
  }
  return str;
}

function displayStudentName(name: string): string {
  return fixMojibake(name);
}

function gradeLabel(value: "A" | "X" | null): string {
  if (value === "A") return "Aprobado (A)";
  if (value === "X") return "Desaprobado (X)";
  return "Sin información";
}

function GradeBadge({ value }: { value: "A" | "X" | null }) {
  const tone =
    value === "A"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : value === "X"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <span
      role="img"
      aria-label={gradeLabel(value)}
      title={gradeLabel(value)}
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${tone}`}
    >
      {value ?? "—"}
    </span>
  );
}

function situationDotClass(type: DetectedSituation["type"]): string {
  if (type === "persistent_difficulty" || type === "disapproved" || type === "recent_difficulty") {
    return "bg-rose-500";
  }
  if (type === "incomplete_information") return "bg-sky-500";
  if (type === "positive_evolution" || type === "no_disapprovals_recorded") return "bg-emerald-500";
  return "bg-slate-400";
}

function recommendationDotClass(priority: "high" | "normal" | "low"): string {
  if (priority === "high") return "bg-rose-500";
  if (priority === "normal") return "bg-blue-500";
  return "bg-slate-400";
}

function DetailCard({
  title,
  count,
  className = "",
  children,
}: {
  title: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h5>
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
            {count}
          </span>
        )}
      </div>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "requires_attention", label: "Requieren atención" },
  { key: "priority_attention", label: "Atención prioritaria" },
  { key: "positive_evolution", label: "Evolución favorable" },
  { key: "incomplete_information", label: "Información incompleta" },
  { key: "no_disapprovals_recorded", label: "Sin desaprobaciones registradas" },
];

function CategoryBadges({ categories }: { categories: StudentAnalysis["categories"] }) {
  const labels: Record<StudentAnalysis["categories"][number], string> = {
    priority_attention: "Atención prioritaria",
    requires_attention: "Requiere atención",
    positive_evolution: "Evolución favorable",
    recent_difficulty: "Dificultad reciente",
    incomplete_information: "Información incompleta",
    no_disapprovals_recorded: "Sin desaprobaciones registradas",
  };
  const tones: Record<StudentAnalysis["categories"][number], string> = {
    priority_attention: "bg-rose-50 text-rose-900 ring-rose-200",
    requires_attention: "bg-amber-50 text-amber-900 ring-amber-200",
    positive_evolution: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    recent_difficulty: "bg-orange-50 text-orange-900 ring-orange-200",
    incomplete_information: "bg-sky-50 text-sky-900 ring-sky-200",
    no_disapprovals_recorded: "bg-slate-100 text-slate-800 ring-slate-300",
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => (
        <span
          key={c}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[c]}`}
        >
          {labels[c]}
        </span>
      ))}
    </div>
  );
}

export function ObservationsPanel({
  dataset,
  analyses,
  observations,
}: {
  dataset: NormalizedDataset;
  analyses: StudentAnalysis[];
  observations: ObservationResult[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditEntry>>({});
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [includeNamesInExport, setIncludeNamesInExport] = useState(false);

  const obsById = useMemo(() => new Map(observations.map((o) => [o.studentId, o])), [observations]);
  const analysisById = useMemo(() => new Map(analyses.map((a) => [a.studentId, a])), [analyses]);
  const autoKeyById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of observations) m.set(o.studentId, buildAutoKey(o));
    return m;
  }, [observations]);

  const resolvedSelectedId =
    selectedId && analysisById.has(selectedId) ? selectedId : (analyses[0]?.studentId ?? null);

  // Las ediciones se conservan en sesión. Si cambia la base automática, se marca como desactualizada en la vista.

  const filtered = useMemo(() => {
    return analyses.filter((a) => {
      if (filter === "all") return true;
      return a.categories.includes(filter);
    });
  }, [analyses, filter]);

  const selectedAnalysis = resolvedSelectedId ? analysisById.get(resolvedSelectedId) ?? null : null;
  const selectedObs = resolvedSelectedId ? obsById.get(resolvedSelectedId) ?? null : null;
  const selectedAutoKey = resolvedSelectedId ? autoKeyById.get(resolvedSelectedId) ?? "" : "";
  const selectedEdit = resolvedSelectedId ? edits[resolvedSelectedId] : undefined;

  const isOutdated = Boolean(
    selectedEdit?.isEdited && selectedAutoKey && selectedEdit.baseAutoKey !== selectedAutoKey,
  );

  const currentText: GeneratedText | null = selectedObs
    ? selectedEdit?.text ?? selectedObs.generatedText
    : null;

  function updateText(section: keyof GeneratedText, value: string) {
    if (!resolvedSelectedId || !selectedObs) return;
    const baseAutoKey = selectedEdit?.baseAutoKey ?? selectedAutoKey;
    const baseText = selectedEdit?.text ?? selectedObs.generatedText;
    setEdits((prev) => ({
      ...prev,
      [resolvedSelectedId]: {
        text: { ...baseText, [section]: value },
        isEdited: true,
        baseAutoKey,
      },
    }));
  }

  function regenerateSelected(force = false) {
    if (!resolvedSelectedId || !selectedObs) return;
    const edit = edits[resolvedSelectedId];
    if (edit?.isEdited && !force) return;
    setEdits((prev) => ({
      ...prev,
      [resolvedSelectedId]: {
        text: selectedObs.generatedText,
        isEdited: false,
        baseAutoKey: selectedAutoKey,
      },
    }));
  }

  function forceRegenerate() {
    regenerateSelected(true);
  }

  async function copyCurrent() {
    if (!currentText) return;
    const payload = formatObservationText(currentText);
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus("Observación copiada al portapapeles.");
    } catch {
      setCopyStatus("No se pudo copiar automáticamente. Podés seleccionar y copiar el texto manualmente.");
    }
    setTimeout(() => setCopyStatus(null), 3000);
  }

  function exportCurrentAsText() {
    if (!currentText || !selectedAnalysis) return;
    const idx = analyses.findIndex((a) => a.studentId === selectedAnalysis.studentId);
    exportIndividualText(dataset, selectedAnalysis, currentText, { includeNames: includeNamesInExport }, idx >= 0 ? idx : 0);
  }

  function exportCurrentAsPdf() {
    if (!currentText || !selectedAnalysis || !selectedObs) return;
    const idx = analyses.findIndex((a) => a.studentId === selectedAnalysis.studentId);
    exportIndividualPdf(dataset, selectedAnalysis, selectedObs, currentText, { includeNames: includeNamesInExport }, idx >= 0 ? idx : 0);
  }

  const course = useMemo(() => {
    const total = analyses.length;
    const requires = analyses.filter((a) => a.categories.includes("requires_attention")).length;
    const priority = analyses.filter((a) => a.categories.includes("priority_attention")).length;
    const positive = analyses.filter((a) => a.categories.includes("positive_evolution")).length;
    const incomplete = analyses.filter((a) => a.categories.includes("incomplete_information")).length;
    const none = analyses.filter((a) => a.categories.includes("no_disapprovals_recorded")).length;
    return { total, requires, priority, positive, incomplete, none };
  }, [analyses]);

  function exportAllObservationsText() {
    const parts = analyses.map((a, idx) => {
      const obs = obsById.get(a.studentId);
      if (!obs) return null;
      const text = edits[a.studentId]?.text ?? obs.generatedText;
      const label = studentExportLabel(a, idx, includeNamesInExport);
      return [
        `Alumno: ${label}`,
        `Archivo: ${dataset.context.fileName} | Hoja: ${dataset.context.sheetName}`,
        formatObservationText(text),
        "----------------------------------------",
        "",
      ].join("\n");
    }).filter(Boolean);
    const content = parts.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `observaciones-${dataset.context.sheetName.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      aria-labelledby={`obs-pedagogicas-${dataset.id}`}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h3 id={`obs-pedagogicas-${dataset.id}`} className="text-xl font-semibold text-slate-900">
            Observaciones pedagógicas
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Vista general e individual por alumno. Las observaciones automáticas son determinísticas; podés editarlas y exportarlas.
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
          <label className="inline-flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={includeNamesInExport}
              onChange={(e) => setIncludeNamesInExport(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
            />
            Incluir nombres en las exportaciones
          </label>
          <p className="max-w-xs text-xs text-slate-600 sm:text-right">Por defecto las exportaciones son anónimas y nunca incluyen DNI.</p>
          <button
            type="button"
            onClick={exportAllObservationsText}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none"
          >
            Exportar todas las observaciones (.txt)
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="break-words text-xs font-medium uppercase tracking-wide text-slate-600">Total</p><p className="mt-1 text-xl font-bold text-slate-900">{course.total}</p></div>
        <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="break-words text-xs font-medium uppercase tracking-wide text-amber-900">Requieren atención</p><p className="mt-1 text-xl font-bold text-amber-950">{course.requires}</p></div>
        <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="break-words text-xs font-medium uppercase tracking-wide text-rose-900">Atención prioritaria</p><p className="mt-1 text-xl font-bold text-rose-950">{course.priority}</p></div>
        <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="break-words text-xs font-medium uppercase tracking-wide text-emerald-900">Evolución favorable</p><p className="mt-1 text-xl font-bold text-emerald-950">{course.positive}</p></div>
        <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="break-words text-xs font-medium uppercase tracking-wide text-sky-900">Información incompleta</p><p className="mt-1 text-xl font-bold text-sky-950">{course.incomplete}</p></div>
        <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="break-words text-xs font-medium uppercase tracking-wide text-slate-600">Sin desaprobaciones</p><p className="mt-1 text-xl font-bold text-slate-900">{course.none}</p></div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 xl:max-h-[78vh]">
          <label htmlFor={`filtro-${dataset.id}`} className="block text-sm font-semibold text-slate-900">Filtrar alumnos</label>
          <select
            id={`filtro-${dataset.id}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {filterOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          <p className="mt-2 text-xs text-slate-600">Mostrando {filtered.length} de {analyses.length} alumnos</p>

          <div className="table-scrollbar mt-2 min-h-0 flex-1 space-y-2 overflow-auto pr-1 xl:max-h-none" role="listbox" aria-label="Lista de alumnos">
            {filtered.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">No hay alumnos para este filtro.</p>
            ) : (
              filtered.map((a) => {
                const selected = a.studentId === resolvedSelectedId;
                const edit = edits[a.studentId];
                const autoKey = autoKeyById.get(a.studentId) ?? "";
                const outdated = Boolean(edit?.isEdited && edit.baseAutoKey !== autoKey);
                const showStatusBadges = Boolean(edit?.isEdited || outdated);
                const studentName = displayStudentName(a.studentName);
                return (
                  <button
                    key={a.studentId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedId(a.studentId)}
                    className={`w-full min-w-0 rounded-lg border p-3 text-left transition-colors ${selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <p className="break-words font-semibold text-slate-900">{a.studentNumber ? `${a.studentNumber}. ` : ""}{studentName}</p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-700">X: {a.summary.subjectsWithAnyDisapproval} · X ambos: {a.summary.subjectsWithPersistentDifficulty} · Evol. favorable: {a.summary.subjectsWithPositiveEvolution} · Incompletos: {a.summary.subjectsWithIncompleteInformation}</p>
                    <div className="mt-2"><CategoryBadges categories={a.categories} /></div>
                    {showStatusBadges && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {edit?.isEdited && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200">Editada</span>}
                        {outdated && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200">Desactualizada</span>}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 sm:p-5 xl:max-h-[78vh] xl:overflow-auto table-scrollbar">
          {!selectedAnalysis || !selectedObs || !currentText ? (
            <p className="text-sm text-slate-700">Seleccioná un alumno para ver el detalle.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <h4 className="break-words text-lg font-semibold text-slate-900">{selectedAnalysis.studentNumber ? `${selectedAnalysis.studentNumber}. ` : ""}{displayStudentName(selectedAnalysis.studentName)}</h4>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-inset ring-emerald-200">{selectedAnalysis.summary.approved} {selectedAnalysis.summary.approved === 1 ? "aprobado" : "aprobados"}</span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-inset ring-rose-200">{selectedAnalysis.summary.disapproved} {selectedAnalysis.summary.disapproved === 1 ? "desaprobado" : "desaprobados"}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 ring-1 ring-inset ring-slate-200">{selectedAnalysis.summary.missing} sin dato</span>
                  </div>
                  <div className="mt-2"><CategoryBadges categories={selectedAnalysis.categories} /></div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button type="button" onClick={copyCurrent} className="whitespace-nowrap rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none">Copiar observación</button>
                  <button type="button" onClick={exportCurrentAsText} className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none">Exportar (.txt)</button>
                  <button type="button" onClick={exportCurrentAsPdf} className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none">Exportar informe (PDF)</button>
                  <button type="button" onClick={() => regenerateSelected(false)} disabled={Boolean(selectedEdit?.isEdited)} className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none">Regenerar</button>
                  {selectedEdit?.isEdited && (
                    <button type="button" onClick={forceRegenerate} className="whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline-none">Reemplazar con automática</button>
                  )}
                </div>
              </div>

              <div aria-live="polite" className="min-h-[1.25rem] space-y-1 text-sm leading-relaxed">
                {copyStatus && <p className="font-medium text-emerald-800">{copyStatus}</p>}
                {isOutdated && <p className="font-medium text-amber-900">La observación editada puede estar desactualizada porque cambiaron los resultados analizados. Revisala o reemplazala con una nueva versión automática.</p>}
                {selectedEdit?.isEdited && !isOutdated && <p className="font-medium text-violet-900">Estás viendo/editando una versión manual (diferenciada de la automática).</p>}
              </div>

              <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4">
                  <DetailCard title="Resultados por materia" className="bg-white">
                    <p className="text-xs leading-relaxed text-slate-500">A = aprobado · X = desaprobado · — = sin información</p>
                    <div className="table-scrollbar mt-3 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[19rem] border-collapse text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-900">
                          <tr>
                            <th scope="col" className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Materia</th>
                            <th scope="col" className="border-b border-slate-200 px-3 py-2 text-center font-semibold">1C</th>
                            <th scope="col" className="border-b border-slate-200 px-3 py-2 text-center font-semibold">2C</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAnalysis.subjects.map((s) => (
                            <tr key={s.subject} className="border-b border-slate-200 last:border-0 odd:bg-white even:bg-slate-50">
                              <th scope="row" className="break-words px-3 py-2 text-left font-medium text-slate-900">{s.subject}</th>
                              <td className="px-3 py-2 text-center"><GradeBadge value={s.grades["1C"]} /></td>
                              <td className="px-3 py-2 text-center"><GradeBadge value={s.grades["2C"]} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DetailCard>

                  <DetailCard title="Recomendaciones detectadas" count={selectedObs.recommendations.length} className="bg-white">
                    {selectedObs.recommendations.length === 0 ? (
                      <p className="text-sm leading-relaxed text-slate-600">No se detectaron recomendaciones.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedObs.recommendations.map((r, i) => (
                          <li key={`${r.type}-${i}`} className="flex gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 ring-1 ring-inset ring-slate-200/80">
                            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${recommendationDotClass(r.priority)}`} aria-hidden="true" />
                            <span className="min-w-0 break-words">{r.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DetailCard>
                </div>

                <DetailCard title="Situaciones detectadas" count={selectedObs.situations.length} className="bg-white">
                  {selectedObs.situations.length === 0 ? (
                    <p className="text-sm leading-relaxed text-slate-600">No se detectaron situaciones.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedObs.situations.map((s, i) => (
                        <li key={`${s.type}-${s.subject ?? "all"}-${i}`} className="flex gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 ring-1 ring-inset ring-slate-200/80">
                          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${situationDotClass(s.type)}`} aria-hidden="true" />
                          <span className="min-w-0 break-words">{s.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailCard>

                <DetailCard title="Observación generada / editable" className="bg-slate-50 xl:col-span-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="min-w-0 md:col-span-2">
                      <label className="mb-1 block break-words text-sm font-semibold text-slate-900" htmlFor={`sit-${resolvedSelectedId}`}>Situación académica</label>
                      <textarea id={`sit-${resolvedSelectedId}`} value={currentText.academicSituation} onChange={(e) => updateText("academicSituation", e.target.value)} rows={4} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1 block break-words text-sm font-semibold text-slate-900" htmlFor={`evo-${resolvedSelectedId}`}>Evolución</label>
                      <textarea id={`evo-${resolvedSelectedId}`} value={currentText.evolution} onChange={(e) => updateText("evolution", e.target.value)} rows={4} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1 block break-words text-sm font-semibold text-slate-900" htmlFor={`rec-${resolvedSelectedId}`}>Recomendaciones</label>
                      <textarea id={`rec-${resolvedSelectedId}`} value={currentText.recommendations} onChange={(e) => updateText("recommendations", e.target.value)} rows={4} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">La edición manual se conserva en esta sesión y no se sobrescribe automáticamente si cambian los datos analizados.</p>
                </DetailCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
