# Especificación funcional y técnica: análisis académico y observaciones automáticas

## 1. Objetivo del proyecto

Desarrollar una aplicación web privada para cargar, analizar y visualizar información académica proveniente de archivos Excel.

Una de las funcionalidades principales será la generación automática de observaciones pedagógicas individuales por alumno, utilizando exclusivamente reglas determinísticas, sin inteligencia artificial ni servicios externos.

El sistema debe poder identificar situaciones académicas, detectar materias pendientes, analizar la evolución entre períodos y generar recomendaciones pedagógicas mediante plantillas de texto.

La aplicación está pensada para uso privado, no como SaaS ni como producto multiusuario.

## 2. Restricciones y decisiones generales

- Uso privado.
- Sin sistema de autenticación.
- Sin base de datos ni backend obligatorio.
- Procesamiento local de archivos Excel desde el navegador.
- No enviar información académica ni datos personales a servicios externos.
- No utilizar APIs de inteligencia artificial.
- No depender de servicios pagos.
- Permitir cargar uno o varios archivos Excel.
- Permitir analizar diferentes años lectivos.
- Mantener separados los datos de cada archivo, año, curso y división cuando corresponda.
- Permitir exportar informes y resultados.
- No modificar los archivos Excel originales.

La aplicación debe poder funcionar como una herramienta local, procesando los datos en memoria del navegador.

## 3. Estructura de los datos de origen

La planilla de referencia contiene información académica organizada por alumno y materia.

### 3.1. Columnas identificadas

La estructura incluye:

- Número de alumno.
- Nombre del alumno.
- DNI.
- Biología.
- Construcción de Ciudadanía.
- Educación Artística.
- Educación Física.
- Físico-Química.
- Geografía.
- Historia.
- Inglés.
- Matemáticas.
- Prácticas del Lenguaje.
- Taller.
- Observaciones.

Cada materia contiene dos resultados:

- 1C: primer cuatrimestre.
- 2C: segundo cuatrimestre.

En total, hay 11 materias y 22 resultados por alumno.

### 3.2. Interpretación de resultados

Los valores tienen el siguiente significado:

| Valor | Significado |
|---|---|
| A | Aprobado |
| X | Desaprobado |
| Número | Aprobado si es 6 o mayor; desaprobado si es menor a 6 |
| Vacío | Sin información registrada |

Reglas obligatorias:

- A representa una materia aprobada en el período correspondiente.
- X representa una materia desaprobada en el período correspondiente.
- Las calificaciones numéricas se normalizan con el mismo criterio: 6 o más es aprobado, menos de 6 es desaprobado. Se aceptan decimales con coma o punto (`6,5`, `5.9`).
- Un valor vacío no equivale a aprobado.
- Un valor vacío no equivale a desaprobado.
- Un valor vacío debe considerarse información desconocida o no registrada.
- No inferir resultados académicos a partir de celdas vacías.
- Normalizar los valores antes de analizarlos, contemplando espacios y diferencias entre mayúsculas y minúsculas.

### 3.3. Observaciones originales

La planilla también puede contener observaciones escritas manualmente.

Por ejemplo:

`BIOLOGIA 2ª - PRACTICAS DE LENGUAJE 2ª`

Estas observaciones deben conservarse como información independiente.

No asumir que una materia mencionada en una observación equivale automáticamente a una X en la planilla.

Las observaciones originales y las observaciones generadas por el sistema deben mantenerse separadas.

## 4. Motor de observaciones automáticas

### 4.1. Concepto

El motor de observaciones será un módulo encargado de analizar los resultados de cada alumno y producir un informe pedagógico mediante reglas predefinidas.

No debe utilizar IA ni generación de texto externa.

El funcionamiento será determinístico:

- Ante los mismos datos, debe producir las mismas observaciones.
- Las reglas deben ser explícitas.
- Las recomendaciones deben surgir de condiciones verificables.
- El texto debe generarse mediante plantillas.
- Debe ser posible modificar las reglas sin reescribir toda la aplicación.

### 4.2. Etapas del procesamiento

El motor debe trabajar en este orden:

1. Recibir los resultados normalizados de un alumno.
2. Identificar materias aprobadas, desaprobadas y sin información.
3. Analizar cada materia y comparar sus resultados entre períodos.
4. Detectar situaciones académicas.
5. Clasificar las situaciones según su importancia.
6. Asociar recomendaciones a cada situación.
7. Construir una observación general sin repetir información.
8. Presentar el resultado para revisión y edición por parte del usuario.

No generar conclusiones sobre situaciones que no estén respaldadas por los datos.

## 5. Reglas de detección académica

Las reglas deben analizar cada materia de manera independiente.

### 5.1. Materias pendientes

**Condición:**

Una materia tiene al menos un resultado X.

**Interpretación:**

El alumno registra un resultado desaprobado en esa materia.

**Ejemplo:**

- Biología: X en 2C.
- Inglés: X en 1C.

**Observación:**

"El alumno registra resultados desaprobados en Biología e Inglés."

**Recomendación:**

"Se recomienda organizar instancias de recuperación de los contenidos correspondientes y realizar un seguimiento de su evolución."

Importante: si una materia tiene X en 1C y A en 2C, no debe afirmarse automáticamente que continúa pendiente. El estado final de la materia debe seguir las reglas de acreditación que se definan para la institución.

### 5.2. Dificultad persistente

**Condición:**

La misma materia presenta X en 1C y X en 2C.

**Interpretación:**

Se registran resultados desaprobados en ambos períodos.

**Observación:**

"El alumno presenta resultados desaprobados en ambos períodos en Matemáticas."

**Recomendación:**

"Se recomienda priorizar el acompañamiento en esta materia, revisar los contenidos pendientes y coordinar instancias de apoyo y recuperación."

No afirmar que existe una dificultad de aprendizaje ni atribuir causas personales.

### 5.3. Evolución favorable

**Condición:**

Una materia presenta X en 1C y A en 2C.

**Interpretación:**

El resultado del segundo período es favorable respecto del primero.

**Observación:**

"Se observa una evolución favorable en Historia, donde el alumno pasó de un resultado desaprobado en el primer período a uno aprobado en el segundo."

**Recomendación:**

"Se recomienda sostener las estrategias de acompañamiento que favorecieron esta evolución."

No afirmar que la materia está definitivamente acreditada si la institución requiere otras condiciones.

### 5.4. Dificultad reciente

**Condición:**

Una materia presenta A en 1C y X en 2C.

**Interpretación:**

Se registra un resultado desaprobado en el segundo período después de haber obtenido uno aprobado en el primero.

**Observación:**

"En Inglés se registra un resultado aprobado durante el primer período y desaprobado durante el segundo."

**Recomendación:**

"Se recomienda revisar los contenidos correspondientes al segundo período e identificar los aspectos que requieren refuerzo."

No afirmar que el alumno empeoró por falta de interés, ausentismo u otra causa que no figure en los datos.

### 5.5. Materias aprobadas en ambos períodos

**Condición:**

Una materia presenta A en 1C y A en 2C.

**Interpretación:**

Se registran resultados aprobados en ambos períodos.

**Observación opcional:**

"El alumno registra resultados aprobados en ambos períodos en esta materia."

No es necesario generar una observación individual por cada materia aprobada. Se pueden agrupar en un resumen.

### 5.6. Información incompleta

**Condición:**

Una o más materias tienen valores vacíos.

**Interpretación:**

No hay información suficiente para analizar esos períodos.

**Observación:**

"Se identifican registros académicos incompletos en las materias: {materias}."

**Recomendación:**

"Se recomienda verificar y completar la información antes de elaborar una valoración académica definitiva."

Los registros vacíos no deben incorporarse a los cálculos de aprobación o desaprobación.

### 5.7. Sin materias desaprobadas registradas

**Condición:**

Todas las materias con información disponible tienen A y no existe ninguna X.

**Interpretación:**

No se registran resultados desaprobados.

**Observación:**

"En los registros disponibles no se identifican materias con resultados desaprobados."

Si existen celdas vacías, agregar una aclaración:

"Sin embargo, hay períodos sin información registrada que requieren verificación."

No utilizar la frase "tiene todas las materias aprobadas" si existen resultados vacíos.

## 6. Clasificación de situaciones

Las situaciones detectadas deben agruparse para facilitar su interpretación.

| Categoría | Condición |
|---|---|
| Requiere atención | Una o más materias con X |
| Atención prioritaria | Una o más materias con X en ambos períodos |
| Evolución favorable | X en 1C y A en 2C |
| Dificultad reciente | A en 1C y X en 2C |
| Información incompleta | Existen períodos sin datos |
| Sin desaprobaciones registradas | No hay X en los datos disponibles |

Una situación puede pertenecer a varias categorías simultáneamente.

Por ejemplo, un alumno puede presentar una dificultad persistente en Matemáticas, una evolución favorable en Historia y registros incompletos en Inglés.

No se debe forzar una clasificación única cuando existen distintas situaciones.

## 7. Generación de recomendaciones

Las recomendaciones se deben construir a partir de las reglas detectadas.

### 7.1. Recomendaciones por situación

| Situación | Recomendación |
|---|---|
| Materia desaprobada | Organizar actividades de recuperación. |
| Desaprobación en ambos períodos | Priorizar el acompañamiento y revisar los contenidos pendientes. |
| Mejora entre períodos | Sostener las estrategias de acompañamiento. |
| Desaprobación reciente | Revisar los contenidos del segundo período. |
| Información incompleta | Verificar los registros antes de realizar una valoración definitiva. |
| Varias materias pendientes | Coordinar un plan de recuperación y seguimiento. |

### 7.2. Recomendaciones combinadas

Si un alumno tiene varias situaciones, el sistema debe combinar las recomendaciones.

Ejemplo:

- Matemáticas: X en ambos períodos.
- Biología: X en 2C.
- Inglés: X en 2C.
- Historia: X en 1C y A en 2C.

El sistema debería producir una recomendación que:

1. Priorice Matemáticas por registrar resultados desaprobados en ambos períodos.
2. Proponga recuperación para Biología e Inglés.
3. Recomiende sostener el acompañamiento en Historia.

Evitar repetir la misma recomendación varias veces.

### 7.3. Recomendaciones generales

Cuando existan varias materias pendientes, puede generarse una recomendación global:

"Se recomienda organizar un plan de recuperación que contemple las materias pendientes, estableciendo prioridades y realizando un seguimiento periódico de los avances."

No generar recomendaciones de apoyo familiar, diagnóstico, tratamiento psicológico o intervención clínica.

## 8. Construcción de la observación individual

La observación final debe organizarse en tres secciones.

### 8.1. Situación académica

Describe qué resultados presenta el alumno.

Debe incluir:

- Materias desaprobadas.
- Materias con resultados desaprobados en ambos períodos.
- Materias con resultados aprobados en ambos períodos, cuando sea relevante.
- Registros incompletos.

### 8.2. Evolución

Describe los cambios entre períodos.

Debe identificar:

- Materias con evolución favorable.
- Materias con dificultades recientes.
- Materias con resultados persistentemente desaprobados.

Si no existe información suficiente, no generar conclusiones sobre evolución.

### 8.3. Recomendaciones

Propone acciones pedagógicas concretas basadas en las situaciones detectadas.

Debe evitar recomendaciones genéricas repetidas cuando exista una recomendación más específica.

### 8.4. Ejemplo completo

**Datos ficticios:**

| Materia | 1C | 2C |
|---|---|---|
| Biología | A | X |
| Historia | X | A |
| Inglés | A | X |
| Matemáticas | X | X |
| Geografía | A | A |
| Educación Física | A | A |

**Observación generada:**

**Situación académica**

El alumno registra resultados desaprobados en Biología, Inglés y Matemáticas. En Matemáticas se observan resultados desaprobados durante ambos períodos.

**Evolución**

Se identifica una evolución favorable en Historia, donde pasó de un resultado desaprobado en el primer período a uno aprobado en el segundo.

En Biología e Inglés se registran resultados aprobados durante el primer período y desaprobados durante el segundo.

**Recomendaciones**

Se recomienda priorizar el acompañamiento y las actividades de recuperación en Matemáticas. Asimismo, organizar instancias de recuperación para Biología e Inglés, revisando los contenidos correspondientes al segundo período.

Se sugiere sostener las estrategias que favorecieron la evolución positiva en Historia.

## 9. Prevención de observaciones incorrectas

El sistema debe respetar las siguientes restricciones:

- No inferir causas de desaprobación.
- No atribuir falta de interés, responsabilidad o compromiso.
- No realizar diagnósticos de aprendizaje.
- No afirmar que un alumno tiene problemas familiares.
- No interpretar un campo vacío como aprobado o desaprobado.
- No considerar automáticamente una X en 1C como materia pendiente al finalizar el año.
- No confundir la mejora entre períodos con acreditación definitiva.
- No confundir las observaciones manuales con resultados académicos.
- No generar recomendaciones que no estén relacionadas con los resultados.
- No emitir conclusiones definitivas cuando la información sea insuficiente.

La redacción debe ser neutral, descriptiva y pedagógica.

## 10. Configuración de reglas

Las reglas deben estar separadas de la interfaz.

Se recomienda crear una configuración centralizada para poder modificar:

- Nombre de las categorías.
- Prioridad de cada situación.
- Plantillas de observaciones.
- Plantillas de recomendaciones.
- Cantidad de materias pendientes para activar recomendaciones generales.
- Inclusión o exclusión de determinadas secciones.
- Nivel de detalle de los informes.

No incluir textos pedagógicos dispersos por distintos componentes de la interfaz.

La configuración debe permitir ampliar el motor sin modificar la lógica principal.

## 11. Edición manual de observaciones

El resultado automático no debe ser inmodificable.

El usuario debe poder:

1. Generar una observación.
2. Visualizar la situación detectada.
3. Editar el texto.
4. Agregar información manual.
5. Quitar recomendaciones que no considere adecuadas.
6. Regenerar el texto.
7. Copiar el resultado.
8. Exportar el informe.

La edición manual debe diferenciarse del resultado automático.

Si cambian los resultados académicos, la aplicación debe indicar que la observación anterior podría estar desactualizada.

No sobrescribir silenciosamente una observación que el usuario haya editado.

Como no existe base de datos, la persistencia de las ediciones puede limitarse a la sesión actual, o implementarse como una exportación e importación explícita de informes.

## 12. Interfaz de observaciones

Crear una sección llamada:

**Observaciones pedagógicas**

### 12.1. Vista general

Mostrar una lista de alumnos con:

- Nombre.
- Cantidad de materias con X.
- Cantidad de materias con X en ambos períodos.
- Cantidad de materias con evolución favorable.
- Cantidad de registros incompletos.
- Estado general de seguimiento.

Permitir filtrar por:

- Todos.
- Requieren atención.
- Atención prioritaria.
- Evolución favorable.
- Información incompleta.
- Sin desaprobaciones registradas.

### 12.2. Vista individual

Al seleccionar un alumno, mostrar:

1. Resumen académico.
2. Resultados por materia.
3. Situaciones detectadas.
4. Observación generada.
5. Recomendaciones.
6. Editor de texto.
7. Acciones de copiar y exportar.

### 12.3. Indicadores visuales

Utilizar indicadores visuales consistentes:

- Atención prioritaria.
- Requiere atención.
- Evolución favorable.
- Información incompleta.
- Sin desaprobaciones registradas.

No depender exclusivamente de colores: incluir siempre etiquetas textuales.

## 13. Análisis general del curso

Además de los informes individuales, el motor debe poder generar observaciones generales del curso.

Ejemplos:

- Materias con mayor cantidad de resultados desaprobados.
- Materias con mayor cantidad de resultados desaprobados en ambos períodos.
- Materias donde se observa una evolución favorable.
- Cantidad de alumnos con al menos una X.
- Cantidad de alumnos con registros incompletos.

Ejemplo de observación:

"En el curso se registra una mayor concentración de resultados desaprobados en Matemáticas y Biología. Se recomienda analizar los contenidos que presentan mayores dificultades y evaluar la implementación de instancias de refuerzo."

La observación debe construirse con cantidades y porcentajes reales.

No utilizar expresiones como "la mayoría" si los cálculos no lo justifican.

## 14. Compatibilidad con varios archivos y años

La aplicación debe permitir cargar distintos archivos Excel correspondientes a diferentes años lectivos.

Cada conjunto de datos debe conservar su contexto:

- Año lectivo.
- Curso.
- División, si está disponible.
- Archivo de origen.
- Lista de alumnos.
- Materias y resultados.

No asumir que todos los archivos tienen exactamente las mismas columnas.

Se debe implementar un proceso de reconocimiento y mapeo de columnas.

### 14.1. Comparación histórica

Cuando existan datos de distintos años, se podrá analizar:

- Evolución de resultados por materia.
- Evolución general del curso.
- Materias que concentran dificultades en distintos años.
- Evolución individual de alumnos identificables.

Para comparar alumnos entre archivos, utilizar el DNI como identificador interno cuando esté disponible.

No mostrar el DNI en informes compartidos ni en gráficos públicos.

Si no existe un identificador confiable, no asumir que dos alumnos con nombres similares son la misma persona.

### 14.2. Observaciones históricas

El sistema podrá comparar observaciones generadas en diferentes años.

Ejemplo:

"En los registros del año anterior se identificaban resultados desaprobados en Matemáticas. En el período actual se observan resultados aprobados en ambos cuatrimestres."

Esta comparación solo debe realizarse cuando los registros permitan identificar correctamente al mismo alumno y las materias sean comparables.

No presentar una comparación histórica como una tendencia cuando solo se dispone de un año.

## 15. Arquitectura sugerida

Mantener una arquitectura modular y sencilla.

Separar como mínimo:

### Importación

Responsable de:

- Leer archivos Excel.
- Identificar hojas.
- Reconocer encabezados.
- Normalizar nombres de columnas.
- Validar datos.
- Convertir filas en registros de alumnos.

### Normalización

Responsable de:

- Normalizar A/X y calificaciones numéricas (≥ 6 = aprobado, < 6 = desaprobado).
- Conservar valores vacíos.
- Normalizar nombres de materias.
- Normalizar períodos.
- Identificar datos incompletos.
- Conservar observaciones originales.

### Análisis académico

Responsable de:

- Calcular resultados por alumno.
- Calcular resultados por materia.
- Calcular porcentajes.
- Identificar materias pendientes según las reglas configuradas.
- Comparar períodos.
- Preparar los indicadores.

### Motor de observaciones

Responsable de:

- Evaluar reglas.
- Detectar situaciones.
- Asociar recomendaciones.
- Generar textos mediante plantillas.
- Evitar repeticiones.
- Devolver resultados estructurados.

### Visualización

Responsable de:

- Mostrar gráficos.
- Mostrar tablas.
- Mostrar indicadores.
- Mostrar informes individuales y generales.

### Exportación

Responsable de:

- Exportar informes individuales.
- Exportar informes del curso.
- Exportar observaciones.
- Exportar resultados procesados.

El motor de observaciones no debe depender de componentes visuales.

## 16. Modelo de salida del motor

El motor debe devolver información estructurada, no solamente un texto.

Ejemplo conceptual:

```json
{
  "studentId": "internal-student-id",
  "summary": {
    "approved": 8,
    "disapproved": 3,
    "missing": 1
  },
  "situations": [
    {
      "type": "persistent_difficulty",
      "subject": "Matemáticas",
      "periods": ["1C", "2C"],
      "priority": "high"
    },
    {
      "type": "positive_evolution",
      "subject": "Historia",
      "periods": ["1C", "2C"],
      "priority": "normal"
    }
  ],
  "recommendations": [
    {
      "type": "recovery",
      "subjects": ["Matemáticas"],
      "priority": "high"
    }
  ],
  "generatedText": {
    "academicSituation": "...",
    "evolution": "...",
    "recommendations": "..."
  },
  "generatedAt": "..."
}
```

El ejemplo es orientativo. Adaptar nombres y tipos al lenguaje y arquitectura elegidos.

No almacenar el DNI dentro del texto generado ni utilizarlo como identificador visible.

## 17. Gráficos relacionados con las observaciones

El sistema también debe permitir visualizar información que ayude a interpretar las observaciones.

Gráficos recomendados:

1. Alumnos que requieren atención.
2. Alumnos con dificultades persistentes.
3. Alumnos con evolución favorable.
4. Cantidad de situaciones detectadas por materia.
5. Distribución de recomendaciones por tipo.
6. Materias con mayor cantidad de dificultades persistentes.
7. Comparación de situaciones entre períodos.
8. Comparación histórica entre años.
9. Matriz de alumnos y materias con situaciones detectadas.
10. Distribución de alumnos según cantidad de materias pendientes.
11. Desaprobaciones por cuatrimestre: cantidad de resultados X y de alumnos con desaprobaciones en 1C y 2C, con número y porcentaje.
12. Materias en observación: cantidad y porcentaje de alumnos que tienen cada materia en el texto original de observaciones, con tabla por alumno.
13. Porcentaje de alumnos con materias desaprobadas, con tablas separadas de 5 o más, 1 a 4 y ninguna materia desaprobada.

Los gráficos deben basarse en datos reales y ocultar información personal identificable.

## 18. Pruebas necesarias

Implementar pruebas unitarias para cada regla.

### Caso 1: desaprobación persistente

Entrada:

- Matemáticas: X / X.

Resultado esperado:

- Detectar `persistent_difficulty`.
- Prioridad alta.
- Recomendar recuperación y seguimiento.

### Caso 2: evolución favorable

Entrada:

- Historia: X / A.

Resultado esperado:

- Detectar `positive_evolution`.
- Recomendar sostener las estrategias de acompañamiento.

### Caso 3: dificultad reciente

Entrada:

- Inglés: A / X.

Resultado esperado:

- Detectar `recent_difficulty`.
- Recomendar revisar contenidos del segundo período.

### Caso 4: resultados aprobados

Entrada:

- Biología: A / A.

Resultado esperado:

- No detectar desaprobaciones.
- No generar recomendaciones de recuperación.

### Caso 5: información incompleta

Entrada:

- Geografía: A / vacío.

Resultado esperado:

- Detectar información incompleta.
- No interpretar el vacío como X ni como A.

### Caso 6: datos completamente vacíos

Entrada:

- Todas las materias sin resultados.

Resultado esperado:

- No afirmar que el alumno aprobó o desaprobó.
- Indicar que no hay información suficiente para elaborar una valoración.

### Caso 7: combinación de situaciones

Entrada:

- Matemáticas: X / X.
- Historia: X / A.
- Inglés: A / X.
- Biología: A / A.

Resultado esperado:

- Detectar dificultad persistente en Matemáticas.
- Detectar evolución favorable en Historia.
- Detectar dificultad reciente en Inglés.
- No generar recomendaciones de recuperación para Biología.
- Construir un informe sin frases repetidas.

### Caso 8: observación manual

Entrada:

- Resultados académicos válidos.
- Observación original escrita en Excel.

Resultado esperado:

- Conservar la observación original.
- Generar una observación automática independiente.
- No interpretar automáticamente el texto original como una X.

### Caso 9: regeneración

Entrada:

- Una observación automática fue editada manualmente.
- Cambian los resultados académicos.

Resultado esperado:

- Identificar que la observación quedó desactualizada.
- No sobrescribir silenciosamente el texto editado.
- Permitir generar una nueva versión.

## 19. Privacidad y tratamiento de datos

Los archivos pueden contener nombres y DNI de alumnos.

Por lo tanto:

- Procesar los archivos localmente.
- No enviar datos a APIs externas.
- No registrar DNI en logs.
- No incluir DNI en gráficos.
- No incluir DNI en informes destinados a compartir.
- Evitar almacenar información personal innecesariamente.
- No utilizar analíticas externas.
- No subir los archivos originales a servicios externos.
- Limpiar los datos de memoria cuando el usuario cierre o reinicie la sesión, según el comportamiento de la aplicación.

Los informes exportados deben contener únicamente la información necesaria para su finalidad.

## 20. Exportación de informes

Permitir exportar:

### Informe individual

- Nombre del alumno.
- Año lectivo.
- Curso y división, cuando estén disponibles.
- Resumen académico.
- Situaciones detectadas.
- Observación pedagógica.
- Recomendaciones.

### Informe general

- Cantidad de alumnos.
- Resultados generales.
- Materias con mayor cantidad de X.
- Situaciones detectadas.
- Recomendaciones generales del curso.

Formatos deseados:

- PDF para informes legibles.
- Excel para datos tabulares.
- Texto para copiar observaciones.

No incluir DNI por defecto.

## 21. Criterios de aceptación

La funcionalidad se considera implementada cuando:

- Puede analizar los resultados de un alumno.
- Reconoce correctamente A, X y valores vacíos.
- Detecta las situaciones académicas definidas.
- Compara correctamente 1C y 2C.
- Genera observaciones mediante plantillas.
- Genera recomendaciones relacionadas con las situaciones detectadas.
- Combina varias situaciones sin duplicar frases.
- No inventa causas ni conclusiones.
- Permite editar observaciones.
- No sobrescribe cambios manuales sin confirmación.
- Permite generar observaciones para todos los alumnos.
- Permite generar un informe general del curso.
- Funciona sin IA ni APIs externas.
- No necesita una base de datos.
- Puede trabajar con distintos archivos y años.
- Mantiene la privacidad de los datos.

## 22. Orden recomendado de implementación

### Fase 1: normalización

- Implementar importación Excel.
- Reconocer hojas y encabezados.
- Normalizar materias, períodos y resultados.
- Validar A, X y vacíos.
- Crear un modelo de datos uniforme.

### Fase 2: análisis académico

- Calcular indicadores por alumno.
- Calcular indicadores por materia.
- Comparar períodos.
- Detectar registros incompletos.

### Fase 3: motor de reglas

- Implementar reglas de detección.
- Implementar categorías.
- Implementar prioridades.
- Implementar recomendaciones.
- Crear plantillas de texto.
- Implementar combinación de observaciones.

### Fase 4: interfaz

- Crear listado de alumnos.
- Crear vista individual.
- Mostrar situaciones detectadas.
- Mostrar observaciones.
- Implementar edición manual.
- Implementar filtros.

### Fase 5: informes y exportación

- Exportar observaciones individuales.
- Exportar informes generales.
- Exportar resultados procesados.
- Incorporar gráficos relacionados.

### Fase 6: múltiples años

- Permitir cargar varios archivos.
- Identificar año, curso y división.
- Comparar resultados.
- Implementar seguimiento histórico cuando los datos lo permitan.

## 23. Instrucciones para el desarrollo con OpenCode

Antes de implementar:

1. Inspeccionar el proyecto existente.
2. Identificar el framework, dependencias y estructura actual.
3. Revisar cómo se importan actualmente los archivos Excel.
4. Reutilizar componentes y utilidades existentes cuando sea apropiado.
5. No reemplazar tecnologías ni reorganizar el proyecto sin una razón concreta.
6. No agregar backend ni base de datos.
7. No agregar servicios externos.
8. Mantener separado el motor de reglas de la interfaz.

Implementar primero la normalización y el análisis académico. Después construir el motor de observaciones sobre datos ya normalizados.

No implementar todas las fases en un único cambio. Avanzar por etapas, realizar pruebas y verificar cada funcionalidad antes de continuar.

Si se encuentra una ambigüedad en las reglas de acreditación institucional, no asumir una respuesta: dejarla configurable o solicitar una definición.

## 24. Decisión pendiente: acreditación final de materias

Los valores A/X representan resultados por cuatrimestre, pero no definen por sí solos todas las reglas institucionales de acreditación anual.

Antes de generar afirmaciones como "debe recuperar Matemáticas" o "tiene la materia pendiente", es necesario definir cómo se acredita una materia.

Por ejemplo:

- ¿Una A en 2C permite considerar aprobada la materia aunque tenga X en 1C?
- ¿Una X en cualquiera de los períodos implica que debe recuperar ese período?
- ¿Existen instancias de recuperación posteriores?
- ¿La observación debe hablar de "materias desaprobadas", "períodos desaprobados" o "materias pendientes"?

Hasta que esto se defina, utilizar expresiones descriptivas como "registra un resultado desaprobado en Matemáticas durante el segundo período".

Esta distinción es fundamental para no generar informes pedagógicos incorrectos.

---

**Resultado esperado:** una aplicación académica privada, local y sin base de datos, capaz de analizar planillas Excel, visualizar el rendimiento de alumnos y cursos, y generar observaciones pedagógicas automáticas, editables y fundamentadas exclusivamente en los datos disponibles.
