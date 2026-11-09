# Calculadora de Varillas para Columnas de Concreto (PWA)

Calculadora **preliminar** del número y diámetro de varillas para una columna de concreto reforzado.
Funciona 100 % en el navegador, sin backend, y se puede instalar como aplicación en Windows.

---

## 1. Cómo ejecutarla

Descomprime la carpeta y, desde dentro de `calculadora-varillas`, levanta un servidor local.

**Con Python (ya viene en la mayoría de equipos):**

```bash
cd calculadora-varillas
python -m http.server 8080
```

Luego abre en Chrome o Edge:

```
http://localhost:8080
```

**Alternativa con Node.js:**

```bash
npx serve -l 8080
```

**Para desarrollar (recomendado):** `http-server` envía `cache-control: max-age=3600`, así
que el navegador conserva los archivos una hora y no ves tus cambios. Desactiva esa caché:

```bash
npx http-server -c-1 -p 8080
```

> ⚠️ Es necesario usar un servidor local. Si abres `index.html` con doble clic
> (`file://`), el Service Worker no se registra y la PWA no se puede instalar.

---

## 2. Cómo instalarla como aplicación

1. Abre `http://localhost:8080` en **Chrome** o **Edge**.
2. Aparecerá el botón naranja **⬇ Instalar** en el encabezado.
   También puedes usar el icono de instalación en la barra de direcciones,
   o el menú ⋮ → *Instalar esta aplicación* / *Aplicaciones → Instalar este sitio*.
3. La app se abrirá en su propia ventana, sin barra de navegador, con su icono
   en el menú Inicio.

Una vez cargada por primera vez, funciona **sin conexión** gracias al Service Worker.

### Superposición de controles de ventana (Window Controls Overlay)

En escritorio (Edge o Chrome 105+ en Windows, macOS y Linux) la app instalada puede usar
su propia barra de título: **el encabezado de la app (logo, título y botón de instalar)
ocupa el área de la barra de título**, igual que la demo 1DIV de Microsoft, y los botones
de minimizar, maximizar y cerrar quedan superpuestos. Referencia:
[Microsoft Learn](https://learn.microsoft.com/es-es/microsoft-edge/progressive-web-apps/how-to/window-controls-overlay).

| Pieza | Dónde | Qué hace |
|---|---|---|
| `display_override: ["window-controls-overlay"]` | `manifest.json` | Activa la característica. Donde no se soporte se usa `display: standalone`. |
| `navigator.windowControlsOverlay` + `geometrychange` | `wco.js` | Marca `<html class="wco">` mientras exista la barra de título propia y lo actualiza (con *debounce*) cuando el usuario la muestra u oculta. |
| `env(titlebar-area-x / y / width / height)` | `style.css` | Coloca el encabezado en el espacio libre, sin tapar los botones (a la derecha en Windows, a la izquierda en macOS). |
| `app-region: drag` / `no-drag` | `style.css` | Arrastrar el encabezado mueve la ventana; los botones dentro de él siguen siendo pulsables. |

Todo lo anterior solo se aplica con la clase `wco`: en una pestaña normal el encabezado
se ve igual que siempre. Si la ventana es angosta, primero se oculta el subtítulo y luego
el texto, y queda solo el icono.

> **Importante:** instálala desde `http://localhost:8080`, no desde una IP de red
> (`http://192.168.x.x`). Una IP sin HTTPS no es un contexto seguro: Edge solo crea un
> acceso directo con la etiqueta "No seguro" y la superposición no se activa.
>
> Si ya tenías la app instalada, **desinstálala** (`edge://apps`) y vuelve a instalarla
> para que se aplique el cambio.
>
> Para probarlo sin instalar: DevTools → *Application* → *Manifest* → *Window Controls
> Overlay* → marcar *Emulate the Window Controls Overlay*. Los botones que se dibujan son
> una **imagen estática** (no se pueden pulsar) y el arrastre no se puede probar así.

---

## 3. Estructura del proyecto

```
calculadora-varillas/
├── index.html      Estructura de la interfaz
├── style.css       Estilos (responsive: PC, tablet y teléfono)
├── app.js          Cálculos, historial, registro del Service Worker
├── wco.js          Superposición de controles de ventana (barra de título propia)
├── manifest.json   Metadatos de la PWA (nombre, iconos, colores, widget)
├── sw.js           Service Worker (caché, funcionamiento sin conexión y widget)
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-512-maskable.png
├── widgets/
│   ├── varillas-template.json     Plantilla (tarjeta adaptable) del widget
│   ├── varillas-data.json         Datos por defecto del widget
│   └── varillas-screenshot.png    Vista previa del widget (300 × 304)
└── assets/         Recursos adicionales
```

---

## 4. Fórmulas utilizadas

| Concepto | Fórmula |
|---|---|
| Área de la columna | `Ag = ancho × largo` (cm²) |
| Área de acero requerida | `As = Ag × % / 100` (cm²) |
| Diámetro en cm | `d = pulgadas × 2.54` |
| Área de una varilla | `Ab = π × d² / 4` |
| Número de varillas | `n = ⌈As / Ab⌉` (redondeo hacia arriba) |
| As proporcionada | `As_prop = n × Ab` |
| % real de acero | `(As_prop / Ag) × 100` |

Áreas unitarias resultantes:

| Varilla | Diámetro | Área |
|---|---:|---:|
| 3/8" | 0.95 cm | 0.71 cm² |
| 1/2" | 1.27 cm | 1.27 cm² |
| 5/8" | 1.59 cm | 1.98 cm² |
| 3/4" | 1.91 cm | 2.85 cm² |
| 1" | 2.54 cm | 5.07 cm² |
| 1 1/4" | 3.18 cm | 7.92 cm² |

### Casilla "armado simétrico"
Cuando está activada (por omisión) se eleva el resultado al **mínimo de 4 varillas**
y a un **número par**, que es lo habitual en columnas rectangulares. Desactívala si
quieres el número crudo que sale de la fórmula.

### Recomendación automática
Recorre los seis diámetros y elige el que deja el **menor exceso de acero**, dando
preferencia a las opciones con una cantidad constructivamente razonable
(entre 4 y 12 varillas). La tabla de alternativas siempre muestra todas las opciones.

---

## 5. Historial

Los últimos 10 cálculos se guardan en `localStorage` (fecha, dimensiones, porcentaje,
diámetro, cantidad y resultado). También se recuerda el último porcentaje y diámetro
usados. El botón *Eliminar historial* los borra.

---

## 6. Compartir contenido con otras aplicaciones

Implementa las dos direcciones de la guía de
[Microsoft Learn](https://learn.microsoft.com/es-es/microsoft-edge/progressive-web-apps/how-to/share).

### Compartir desde la app (Web Share API)

| Dónde | Qué comparte | API |
|---|---|---|
| Botón **📤 Compartir resultado** | Título, resumen del cálculo y enlace de la app | `navigator.share({ title, text, url })` |
| Botón **📄 Compartir como archivo** | `calculo-varillas.txt` con el resumen y la tabla de alternativas | `navigator.canShare({ files })` + `navigator.share({ files })` |
| **📤 Compartir** en cada cálculo del historial | El resumen de ese cálculo | `navigator.share` |

- Solo funciona en HTTPS o `localhost` y como respuesta a un clic.
- El botón de archivo solo aparece si el navegador permite compartir archivos.
- Si el navegador no tiene Web Share API, el texto se copia al portapapeles.

### Recibir contenido (Web Share Target API)

`manifest.json` declara `share_target` (método `POST`, `multipart/form-data`, y un archivo
`.txt`). **Solo las PWA instaladas** aparecen como destino en el cuadro de compartir del
sistema; la guía de Microsoft lo describe para Windows.

1. El sistema envía un `POST` a `./compartido`.
2. `sw.js` lo intercepta (así funciona sin conexión), guarda título, texto, enlace y el
   contenido del archivo en la caché `calc-varillas-compartido` y redirige (303) a
   `index.html?compartido=1`.
3. `app.js` lee esos datos, busca dimensiones, porcentaje y diámetro (por ejemplo
   `Columna 30 x 40 cm, acero 2 %`), rellena el formulario, calcula y muestra un aviso
   azul con lo recibido. El contenido se trata siempre como texto, nunca como HTML.

Prueba sin otra app, desde la consola de la app instalada (DevTools):

```js
const f = new FormData();
f.append('title', 'Prueba');
f.append('text', 'Columna 40 x 50 cm, acero 2 %');
fetch('./compartido', { method: 'POST', body: f }).then(r => location.href = r.url);
```

---

## 7. Widget en el panel de widgets de Windows 11

Implementa la guía de
[Microsoft Learn](https://learn.microsoft.com/es-es/microsoft-edge/progressive-web-apps/how-to/widgets).
La app instalada ofrece el widget **Último cálculo de varillas**: muestra el último armado
calculado (dimensiones de la columna, diámetro, número de varillas, As y % real) y cuántos
cálculos hay guardados. Sus botones abren la app: **Nuevo cálculo** (con el cursor en el
ancho) y **Ver historial**.

| Pieza | Dónde | Qué hace |
|---|---|---|
| `widgets[]` | `manifest.json` | Declara el widget: nombre, `tag`, plantilla, datos por defecto y captura para el selector. |
| Plantilla de tarjeta adaptable | `widgets/varillas-template.json` | Define la interfaz; los `${...}` se rellenan con los datos. El `verb` de cada botón es `nuevo` o `historial`. |
| Datos por defecto | `widgets/varillas-data.json` | Lo que se ve antes de hacer el primer cálculo. |
| Captura | `widgets/varillas-screenshot.png` | Vista previa de 300 × 304 px en el selector de widgets. |
| `widgetinstall`, `widgetresume`, `activate`, `message`, `widgetclick` | `sw.js` | Dibuja el widget con `self.widgets.updateByTag()` y atiende los botones. |
| `publicarWidget()` | `app.js` | Copia el último cálculo del historial a la caché `calc-varillas-widget` y avisa al Service Worker. |
| `atenderAccionWidget()` | `app.js` | Lee `?accion=nuevo` / `?accion=historial` cuando la app se abre desde un botón del widget. |

El Service Worker no puede leer `localStorage`, por eso `app.js` publica los datos ya
listos para la plantilla en una caché propia (`calc-varillas-widget`, que `activate` no
borra) y le manda un mensaje al Service Worker para que vuelva a dibujar el widget.
El nombre de la caché y la clave deben coincidir en `app.js` y `sw.js`.

Para probarlo (solo **Windows 11** con **Edge**; en otros sistemas el código no hace nada):

1. Instala [WinAppSDK 1.2](https://learn.microsoft.com/es-es/windows/apps/windows-app-sdk/older-downloads#windows-app-sdk-12)
   y activa el **Modo de desarrollador** (Configuración → Para programadores).
2. Instala la app desde `http://localhost:8080`, como en la sección 2. Si ya la tenías
   instalada, desinstálala (`edge://apps`) y vuelve a instalarla para que Windows lea el
   widget del manifest.
3. Abre el panel de widgets con **Win + W** → **Agregar widgets** → *Último cálculo de varillas*.

No se usa `update` ni sincronización periódica: los datos son locales y el widget se
actualiza en cuanto haces un cálculo o borras el historial.

---

## 8. Actualizar la aplicación

Al modificar cualquier archivo, sube el número de versión en `sw.js`:

```js
const VERSION = 'v2';   // antes 'v1'
```

El Service Worker borrará la caché anterior y servirá los archivos nuevos.

---

## ⚠ Aviso importante

Esta herramienta proporciona **cálculos preliminares**. El armado definitivo de una
columna debe ser determinado y revisado por un profesional responsable, considerando
las cargas, materiales, condiciones de apoyo, confinamiento, normas y demás requisitos
estructurales aplicables.
