# Análisis académico y observaciones pedagógicas

Aplicación web **local y privada** para importar planillas académicas (Excel/CSV), analizar resultados por alumno y materia, generar **observaciones pedagógicas automáticas** (con reglas determinísticas, sin inteligencia artificial ni servicios externos), ver gráficos y exportar informes.

## Qué hace la aplicación

- Permite cargar **uno o varios archivos** (`.xlsx`, `.xls`, `.ods`, `.csv`) con una o varias hojas.
- Procesa los datos **en tu navegador**: no envía la información a internet ni a servicios externos y no modifica los archivos originales.
- Normaliza resultados (`A`/`X`/sin dato), muestra tablas por planilla y detecta situaciones académicas.
- Genera observaciones pedagógicas individuales (texto editable en la sesión) y resúmenes del curso.
- Muestra visualizaciones/gráficos con filtro por período (**1C**, **2C** o **Ambos**), útil cuando el segundo cuatrimestre todavía no tiene notas cargadas.
- Exporta informes y resultados (texto, PDF, Excel). **El DNI nunca se incluye** en gráficos ni exportaciones; las exportaciones son anónimas por defecto y podés optar por incluir nombres cuando lo necesites.

## Requisitos previos

Necesitás tener instalado **Node.js** (incluye `npm`, que es el programa que usa la app para instalarse y ejecutarse).

1. Abrí **Visual Studio Code**.
2. Abrí una terminal dentro de Visual Studio Code: menú **Terminal > Nueva terminal** (o **Terminal > New Terminal**).
3. Escribí estos comandos y presioná **Enter** después de cada uno:

   ```bash
   node -v
   npm -v
   ```

4. Si aparecen números de versión (por ejemplo `v20.x.x` y `10.x.x`), ya tenés Node.js instalado y podés seguir con la sección siguiente.
5. Si aparece un mensaje de que el comando no se reconoce:
   - Descargá e instalá **Node.js LTS** desde [https://nodejs.org/](https://nodejs.org/).
   - Durante la instalación, aceptá las opciones predeterminadas.
   - Al terminar, **cerrá y volvé a abrir Visual Studio Code** (y la terminal) y repetí `node -v` y `npm -v` para comprobar.

> Recomendación: usá una versión LTS reciente de Node.js (18 o superior).

## Paso a paso: abrir el proyecto en Visual Studio Code

1. **Conseguí la carpeta del proyecto** en tu computadora (por ejemplo, `cite-tecnica2`).
   - Si la descargaste desde GitHub: en la página del repositorio hacé clic en **Code > Download ZIP**, descomprimí el ZIP y ubicá la carpeta.
   - Repositorio: [https://github.com/sabriclausi/cite-tecnica2](https://github.com/sabriclausi/cite-tecnica2)
2. Abrí **Visual Studio Code**.
3. Menú **Archivo > Abrir carpeta...** (o **File > Open Folder...**).
4. Seleccioná la carpeta del proyecto (la que contiene archivos como `package.json`, `README.md` y la carpeta `src`) y hacé clic en **Seleccionar carpeta / Abrir**.
5. Abrí la terminal integrada: menú **Terminal > Nueva terminal**. La terminal debe quedar ubicada dentro de la carpeta del proyecto.

## Paso a paso: instalar y ejecutar la aplicación

Todos los comandos se escriben en la **terminal de Visual Studio Code**, dentro de la carpeta del proyecto.

### 1. Instalar las dependencias (solo la primera vez)

```bash
npm install
```

- Esto descarga las librerías que la app necesita.
- Puede tardar unos minutos la primera vez. Esperá a que termine y vuelva a aparecer el cursor en la terminal.
- Solo hace falta repetirlo si cambian las dependencias del proyecto.

### 2. Iniciar la aplicación

```bash
npm run dev
```

- La terminal va a mostrar que el servidor está listo y una dirección local, normalmente **http://localhost:3000**.
- **Dejá esta terminal abierta** mientras uses la aplicación (si la cerrás o detenés el proceso, la app deja de funcionar).

### 3. Abrir la aplicación en el navegador

1. Abrí tu navegador (Chrome, Edge, Firefox, etc.).
2. En la barra de direcciones escribí: [http://localhost:3000](http://localhost:3000) y presioná **Enter**.
3. Deberías ver la pantalla de la aplicación para importar planillas.

### 4. Detener la aplicación

- Volvé a la terminal de Visual Studio Code donde está corriendo `npm run dev`.
- Presioná **Ctrl + C**.
- Si te pregunta si querés terminar el proceso, confirmá.

### 5. Volver a usarla más adelante

Cada vez que quieras usar la app:

1. Abrí la carpeta del proyecto en Visual Studio Code.
2. Abrí la terminal (**Terminal > Nueva terminal**).
3. Ejecutá `npm run dev`.
4. Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

(No hace falta volver a ejecutar `npm install` si ya lo hiciste antes y no cambió nada.)

## Cómo usar la aplicación

1. **Importar planillas**
   - En la pantalla principal, usá el selector de archivos para elegir uno o varios archivos `.xlsx`, `.xls`, `.ods` o `.csv`.
   - Podés cargar varias hojas/archivos; cada hoja se procesa como un conjunto de datos separado.
   - La lectura y el análisis se hacen localmente en tu navegador.

2. **Revisar los datos**
   - Vas a ver la tabla normalizada por alumno y materia (1C/2C), advertencias de importación (si las hay) y el contexto del archivo/hoja.
   - Los valores se interpretan como `A` (aprobado), `X` (desaprobado) o sin dato. Las celdas vacías no se inventan.

3. **Observaciones pedagógicas**
   - La app genera observaciones automáticas (determinísticas) por alumno: situación académica, evolución y recomendaciones.
   - Podés **editar** el texto en la sesión, **copiarlo**, **regenerarlo** o reemplazar una edición con la versión automática.
   - Si el 2.º cuatrimestre aún no tiene calificaciones cargadas, las observaciones lo tienen en cuenta (período pendiente) y no lo tratan como información que haya que “verificar/completar” por error de carga.

4. **Visualizaciones (gráficos)**
   - Incluyen gráficos por categorías, situaciones por materia, recomendaciones, dificultades, comparación por período, distribución de materias pendientes y una matriz alumno-materia.
   - Usá el selector de **Período analizado** (`Ambos`, `Solo 1C`, `Solo 2C`) para ver los datos del cuatrimestre que necesites (útil si 2C todavía no terminó).
   - En la matriz podés activar **“Anonimizar nombres”** si vas a proyectar o compartir la pantalla.

5. **Exportar**
   - Podés exportar observaciones individuales (texto/PDF), todas las observaciones (texto), un informe general (PDF) y resultados procesados (Excel).
   - **Privacidad:** el **DNI no se incluye** en gráficos ni exportaciones. Las exportaciones son **anónimas por defecto**; si necesitás nombres para uso interno, activá la opción **“Incluir nombres en las exportaciones”** antes de exportar.

## Privacidad y datos

- Procesamiento **local** en el navegador: no se envían datos a APIs ni servicios externos.
- No se modifican los archivos originales.
- El DNI se usa solo de forma interna cuando corresponde y **no se muestra ni se exporta**.
- Para más detalle funcional y técnico, consultá [GUIA.md](./GUIA.md).

## Solución de problemas comunes

- **`npm` o `node` no se reconoce como comando:** instalá Node.js LTS desde [nodejs.org](https://nodejs.org/), cerrá y volvé a abrir Visual Studio Code y la terminal, y probá de nuevo.
- **`npm install` falla:** verificá tu conexión a internet y que estés dentro de la carpeta correcta del proyecto (donde está `package.json`). Luego volvé a ejecutar `npm install`.
- **El puerto 3000 ya está en uso:** cerrá la otra aplicación que lo use, o iniciá con otro puerto: `npm run dev -- -p 3001` y abrí [http://localhost:3001](http://localhost:3001).
- **La página no carga:** confirmá que `npm run dev` siga corriendo en la terminal y que la dirección sea la que muestra la terminal.
- **La planilla no se interpreta como esperabas:** revisá las advertencias de importación en la app; el formato de columnas/encabezados puede variar. La app intenta detectar nombres, materias y períodos (1C/2C) automáticamente.

## Comandos disponibles

- `npm run dev`: inicia la aplicación en modo desarrollo.
- `npm run build`: genera la versión optimizada.
- `npm run start`: ejecuta la versión optimizada (después de `npm run build`).
- `npm run lint`: revisa el código con ESLint.
