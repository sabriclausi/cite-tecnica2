"use client";

import { useId, useMemo, useState } from "react";
import type { NormalizedDataset, WorkbookImportResult } from "@/types/academic";
import { importWorkbookFile } from "@/lib/import/excel";
import { analyzeDataset } from "@/lib/analysis/analyze";
import { generateObservationsForDataset, detectDatasetPeriodAvailability } from "@/lib/observations/engine";
import { defaultObservationConfig } from "@/lib/observations/config";
import { aggregateCourseData } from "@/lib/analysis/aggregations";
import { exportGeneralReportPdf, exportProcessedResultsExcel } from "@/lib/export/exporters";
import { ChartsPanel } from "@/components/ChartsPanel";
import { ObservationsPanel } from "@/components/ObservationsPanel";

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "info";
}) {
  const toneClass =
    tone === "info"
      ? "bg-blue-50 text-blue-900 ring-blue-200"
      : "bg-slate-100 text-slate-800 ring-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneClass}`}
    >
      {children}
    </span>
  );
}

function GradeCell({ value }: { value: "A" | "X" | null }) {
  if (value === "A") {
    return (
      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-800 ring-1 ring-inset ring-emerald-300">
        A
        <span className="sr-only"> (aprobado)</span>
      </span>
    );
  }
  if (value === "X") {
    return (
      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md bg-rose-50 px-2 py-1 text-sm font-bold text-rose-800 ring-1 ring-inset ring-rose-300">
        X
        <span className="sr-only"> (desaprobado)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300">
      Sin dato
    </span>
  );
}

function AlertList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "warning" | "error";
}) {
  const styles =
    variant === "error"
      ? "border-rose-300 bg-rose-50 text-rose-950"
      : "border-amber-300 bg-amber-50 text-amber-950";
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${styles}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}



function DatasetExports({
  dataset,
  analyses,
  observations,
}: {
  dataset: NormalizedDataset;
  analyses: ReturnType<typeof analyzeDataset>;
  observations: ReturnType<typeof generateObservationsForDataset>;
}) {
  const [includeNamesInExport, setIncludeNamesInExport] = useState(false);
  const aggregations = useMemo(
    () => aggregateCourseData(dataset, analyses, observations),
    [dataset, analyses, observations],
  );
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`export-${dataset.id}`}>
      <h3 id={`export-${dataset.id}`} className="text-xl font-semibold text-slate-900">Informes y exportación</h3>
      <p className="mt-1 text-sm text-slate-700">Exportá informes del curso y resultados procesados. Por defecto las exportaciones son anónimas y nunca incluyen DNI.</p>
      <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={includeNamesInExport}
          onChange={(e) => setIncludeNamesInExport(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
        />
        Incluir nombres en las exportaciones
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => exportGeneralReportPdf(dataset, analyses, observations, aggregations, { includeNames: includeNamesInExport })}
          className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none"
        >
          Exportar informe general (PDF)
        </button>
        <button
          type="button"
          onClick={() => exportProcessedResultsExcel(dataset, analyses, observations, { includeNames: includeNamesInExport })}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none"
        >
          Exportar resultados procesados (Excel)
        </button>
      </div>
    </section>
  );
}

function DatasetView({ dataset }: { dataset: NormalizedDataset }) {
  const headingId = useId();
  const analyses = useMemo(() => analyzeDataset(dataset), [dataset]);
  const observations = useMemo(() => {
    const periods = detectDatasetPeriodAvailability(dataset);
    return generateObservationsForDataset(analyses, { ...defaultObservationConfig, periods });
  }, [analyses, dataset]);
  return (
    <div className="min-w-0 space-y-6">
      <section
        aria-labelledby={headingId}
        className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 id={headingId} className="break-words text-xl font-semibold text-slate-900">
              {dataset.context.fileName}
            </h3>
            <p className="mt-1 break-words text-sm text-slate-700">
              Hoja: <span className="font-medium">{dataset.context.sheetName}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Resumen del conjunto de datos">
            <Badge tone="info">{dataset.students.length} alumnos</Badge>
            <Badge>{dataset.subjects.length} materias</Badge>
          </div>
        </div>

        {dataset.warnings.length > 0 && (
          <div className="mb-5">
            <AlertList
              title="Advertencias de importación"
              items={dataset.warnings.map((w) => w.message)}
              variant="warning"
            />
          </div>
        )}

        <div
          className="table-scrollbar relative max-h-[70vh] w-full max-w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-1"
          tabIndex={0}
          role="region"
          aria-label={`Tabla de resultados de ${dataset.context.sheetName}. Podés desplazarte horizontal y verticalmente dentro de la tabla.`}
        >
          <table className="min-w-max w-full border-collapse text-sm">
            <caption className="sr-only">
              Resultados normalizados por alumno y materia para la hoja {dataset.context.sheetName} del archivo {dataset.context.fileName}.
              Cada materia muestra primer cuatrimestre (1C) y segundo cuatrimestre (2C).
            </caption>
            <thead className="bg-slate-100 text-slate-900">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold whitespace-nowrap"
                >
                  Nº
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 min-w-[14rem] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold whitespace-nowrap"
                >
                  Alumno
                </th>
                {dataset.subjects.map((subject) => (
                  <th
                    key={subject}
                    scope="colgroup"
                    colSpan={2}
                    className="sticky top-0 z-20 min-w-[11rem] border-b border-l border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold align-top"
                  >
                    <div className="whitespace-normal break-words leading-snug">{subject}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
                      <span className="whitespace-nowrap">1C</span>
                      <span className="whitespace-nowrap">2C</span>
                    </div>
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky top-0 z-20 min-w-[18rem] border-b border-l border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold whitespace-nowrap"
                >
                  Observación original
                </th>
              </tr>
            </thead>
            <tbody>
              {dataset.students.map((student) => (
                <tr key={student.id} className="align-top odd:bg-white even:bg-slate-50">
                  <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-3 text-slate-700 whitespace-nowrap">
                    {student.studentNumber ?? <span className="text-slate-500">—</span>}
                  </td>
                  <th
                    scope="row"
                    className="min-w-[14rem] border-b border-r border-slate-200 px-3 py-3 text-left font-semibold text-slate-900 whitespace-normal break-words"
                  >
                    {student.name}
                  </th>
                  {dataset.subjects.map((subject) => {
                    const grades = student.subjects[subject] ?? { "1C": null, "2C": null };
                    return (
                      <td
                        key={subject}
                        colSpan={2}
                        className="min-w-[11rem] border-b border-l border-slate-200 px-3 py-3"
                      >
                        <div
                          className="grid grid-cols-2 gap-2"
                          aria-label={`Resultados de ${subject}: primer cuatrimestre y segundo cuatrimestre`}
                        >
                          <div>
                            <span className="sr-only">1C: </span>
                            <GradeCell value={grades["1C"]} />
                          </div>
                          <div>
                            <span className="sr-only">2C: </span>
                            <GradeCell value={grades["2C"]} />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="min-w-[18rem] border-b border-l border-slate-200 px-3 py-3 text-slate-800 whitespace-normal break-words">
                    {student.originalObservation ?? (
                      <span className="text-slate-500">Sin observación</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DatasetExports dataset={dataset} analyses={analyses} observations={observations} />
      <ChartsPanel dataset={dataset} analyses={analyses} observations={observations} />
      <ObservationsPanel dataset={dataset} analyses={analyses} observations={observations} />
    </div>
  );
}

export function ExcelImportPanel() {
  const [results, setResults] = useState<WorkbookImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputId = useId();
  const helpId = useId();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const allDatasets: NormalizedDataset[] = [];
      const allWarnings: WorkbookImportResult["warnings"] = [];
      for (const file of Array.from(files)) {
        const res = await importWorkbookFile(file);
        allDatasets.push(...res.datasets);
        allWarnings.push(...res.warnings);
      }
      setResults({ datasets: allDatasets, warnings: allWarnings });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ocurrió un error al procesar el archivo. Verificá el formato e intentá nuevamente.",
      );
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const totalStudents =
    results?.datasets.reduce((acc, ds) => acc + ds.students.length, 0) ?? 0;

  return (
    <div className="min-w-0 space-y-6">
      <section
        aria-labelledby="importar-planillas"
        className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 id="importar-planillas" className="text-2xl font-semibold text-slate-900">
          Importar planillas Excel
        </h2>
        <p id={helpId} className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          Seleccioná uno o varios archivos (<code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">.xlsx</code>, <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">.xls</code>, <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">.ods</code>, <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">.csv</code>).
          Los datos se procesan localmente en tu navegador y no se envían a servicios externos.
        </p>

        <div className="mt-5">
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-semibold text-slate-900"
          >
            Archivos de planillas
          </label>
          <input
            id={inputId}
            type="file"
            accept=".xlsx,.xls,.ods,.csv"
            multiple
            aria-describedby={helpId}
            onChange={(e) => void handleFiles(e.target.files)}
            className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-900 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:bg-slate-100 hover:file:bg-blue-800 focus-visible:outline-none"
          />
        </div>

        <div className="mt-4 min-h-[1.5rem]" aria-live="polite">
          {loading && (
            <p className="text-sm font-medium text-blue-800" role="status">
              Procesando archivos… Esto puede demorar según el tamaño de la planilla.
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4">
            <AlertList title="Error al importar" items={[error]} variant="error" />
          </div>
        )}
      </section>

      {results && !loading && (
        <section aria-label="Resultados de la importación" className="min-w-0 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-700">Conjuntos de datos</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{results.datasets.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-700">Alumnos detectados</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalStudents}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-700">Advertencias generales</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{results.warnings.length}</p>
            </div>
          </div>

          {results.warnings.length > 0 && (
            <AlertList
              title="Advertencias generales"
              items={results.warnings.map((w) => w.message)}
              variant="warning"
            />
          )}

          {results.datasets.length === 0 ? (
            <p
              className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
              role="status"
            >
              No se detectaron datos para mostrar. Revisá el formato de la planilla y los encabezados.
            </p>
          ) : (
            results.datasets.map((ds) => <DatasetView key={ds.id} dataset={ds} />)
          )}
        </section>
      )}
    </div>
  );
}
