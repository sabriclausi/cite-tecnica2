import { ExcelImportPanel } from "@/components/ExcelImportPanel";

export default function Home() {
  return (
    <main
      id="contenido-principal"
      className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-8 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8"
    >
      <header className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 inline-flex max-w-full rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800 ring-1 ring-inset ring-blue-200">
          Uso local y privado
        </p>
        <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Análisis académico y observaciones pedagógicas
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
          Cargá planillas Excel para normalizar resultados por cuatrimestre
          (<strong>A</strong>, <strong>X</strong> o sin información), analizar
          situaciones académicas y generar observaciones pedagógicas
          determinísticas. El procesamiento se realiza en tu navegador.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
          <li className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            Sin backend ni base de datos
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            Sin envío de datos a servicios externos
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            Observaciones originales preservadas
          </li>
        </ul>
      </header>

      <ExcelImportPanel />
    </main>
  );
}
