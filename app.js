/* ============================================================
   Calculadora de Varillas — Lógica de la aplicación
   ------------------------------------------------------------
   Sin dependencias externas. Todo corre en el navegador.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   1) CATÁLOGO DE VARILLAS
   Los diámetros comerciales se manejan en pulgadas y se
   convierten a centímetros (1 pulgada = 2.54 cm).
   ------------------------------------------------------------ */
const PULGADA_CM = 2.54;

const VARILLAS = [
  { id: '3/8',   etiqueta: '3/8"',   pulgadas: 0.375 },
  { id: '1/2',   etiqueta: '1/2"',   pulgadas: 0.500 },
  { id: '5/8',   etiqueta: '5/8"',   pulgadas: 0.625 },
  { id: '3/4',   etiqueta: '3/4"',   pulgadas: 0.750 },
  { id: '1',     etiqueta: '1"',     pulgadas: 1.000 },
  { id: '1 1/4', etiqueta: '1 1/4"', pulgadas: 1.250 }
];

// Diámetro en cm y área de la sección transversal: A = π·d²/4
VARILLAS.forEach(v => {
  v.diametroCm = v.pulgadas * PULGADA_CM;
  v.areaCm2    = Math.PI * Math.pow(v.diametroCm, 2) / 4;
});

/* ------------------------------------------------------------
   2) REFERENCIAS DEL DOM
   ------------------------------------------------------------ */
const $ = id => document.getElementById(id);

const formulario   = $('formulario');
const inpAncho     = $('ancho');
const inpLargo     = $('largo');
const inpPorc      = $('porcentaje');
const selVarilla   = $('varilla');
const chkSimetria  = $('simetria');
const divError     = $('error');
const secResultados= $('resultados');
const divLista     = $('listaResultados');
const divCroquis   = $('croquis');
const tbodyTabla   = document.querySelector('#tablaAlternativas tbody');
const ulHistorial  = $('historial');
const divEstado    = $('estado');
const divRecibido  = $('avisoRecibido');
const btnCompartir        = $('btnCompartir');
const btnCompartirArchivo = $('btnCompartirArchivo');

const CLAVE_HISTORIAL = 'calcVarillas.historial';
const CLAVE_ULTIMO    = 'calcVarillas.ultimo';

// Último cálculo mostrado: { registro, opciones }. Lo usan los botones de compartir.
let ultimoCalculo = null;

/* ------------------------------------------------------------
   3) CÁLCULOS
   ------------------------------------------------------------ */

/** Ajusta la cantidad de varillas a un armado simétrico:
 *  mínimo 4 varillas y número par. */
function ajustarSimetria(n) {
  let r = Math.max(4, n);
  if (r % 2 !== 0) r += 1;
  return r;
}

/**
 * Calcula la propuesta para un diámetro dado.
 * @param {number} areaColumna - cm²
 * @param {number} asRequerida - cm²
 * @param {object} varilla     - elemento del catálogo
 * @param {boolean} simetria   - aplicar mínimo 4 y número par
 */
function calcularParaVarilla(areaColumna, asRequerida, varilla, simetria) {
  // Número de varillas: siempre redondeado hacia arriba
  let cantidad = Math.ceil(asRequerida / varilla.areaCm2);
  if (simetria) cantidad = ajustarSimetria(cantidad);

  const asProporcionada = cantidad * varilla.areaCm2;
  const porcentajeReal  = (asProporcionada / areaColumna) * 100;

  return { varilla, cantidad, asProporcionada, porcentajeReal };
}

/**
 * Recomendación automática: entre todos los diámetros, prefiere
 * los que dan una cantidad "constructivamente razonable"
 * (entre 4 y 12 varillas) y el menor exceso de acero.
 */
function recomendar(opciones, asRequerida) {
  const razonables = opciones.filter(o => o.cantidad >= 4 && o.cantidad <= 12);
  const candidatos = razonables.length ? razonables : opciones;

  return candidatos.reduce((mejor, o) =>
    (o.asProporcionada - asRequerida) < (mejor.asProporcionada - asRequerida) ? o : mejor
  );
}

/* ------------------------------------------------------------
   4) PRESENTACIÓN
   ------------------------------------------------------------ */

const num = (v, d = 2) => v.toLocaleString('es-MX', {
  minimumFractionDigits: d,
  maximumFractionDigits: d
});

function item(etiqueta, valor, destacado = false) {
  return `<div class="item${destacado ? ' destacado' : ''}">
            <span class="etiqueta">${etiqueta}</span>
            <span class="valor">${valor}</span>
          </div>`;
}

/** Dibuja un croquis simple de la sección con las varillas repartidas
 *  en el perímetro (solo ilustrativo). */
function dibujarCroquis(ancho, largo, cantidad) {
  const escala = 200 / Math.max(ancho, largo);
  const w = ancho * escala;
  const h = largo * escala;
  const m = 30;                 // margen del lienzo
  const r = 22 * escala > 5 ? 5 : 4;  // radio del punto
  const rec = 14;               // separación del recubrimiento en px

  // Reparte las varillas a lo largo del perímetro del rectángulo interior
  const x0 = m + rec, y0 = m + rec;
  const x1 = m + w - rec, y1 = m + h - rec;
  const perimetro = 2 * ((x1 - x0) + (y1 - y0));
  const paso = perimetro / cantidad;

  let puntos = '';
  for (let i = 0; i < cantidad; i++) {
    let d = i * paso, x, y;
    const lx = x1 - x0, ly = y1 - y0;
    if (d < lx)                { x = x0 + d;            y = y0; }
    else if (d < lx + ly)      { x = x1;                y = y0 + (d - lx); }
    else if (d < 2 * lx + ly)  { x = x1 - (d - lx - ly); y = y1; }
    else                       { x = x0;                y = y1 - (d - 2 * lx - ly); }
    puntos += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#ea7317"/>`;
  }

  divCroquis.innerHTML = `
    <svg viewBox="0 0 ${w + m * 2} ${h + m * 2}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${m}" y="${m}" width="${w}" height="${h}" rx="2"
            fill="#e5e7eb" stroke="#374151" stroke-width="2"/>
      <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"
            fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3"/>
      ${puntos}
      <text x="${m + w / 2}" y="${m - 10}" text-anchor="middle"
            font-size="13" fill="#6b7280">${num(ancho, 0)} cm</text>
      <text x="${m - 10}" y="${m + h / 2}" text-anchor="middle"
            font-size="13" fill="#6b7280"
            transform="rotate(-90 ${m - 10} ${m + h / 2})">${num(largo, 0)} cm</text>
    </svg>`;
}

/* ------------------------------------------------------------
   5) FLUJO PRINCIPAL
   ------------------------------------------------------------ */

function calcular(evento) {
  if (evento) evento.preventDefault();
  divError.hidden = true;

  const ancho = parseFloat(inpAncho.value);
  const largo = parseFloat(inpLargo.value);
  const porc  = parseFloat(inpPorc.value);

  // --- Validación ---
  if (!(ancho > 0) || !(largo > 0)) {
    return mostrarError('Ingresa un ancho y un largo mayores que cero.');
  }
  if (!(porc > 0) || porc > 8) {
    return mostrarError('El porcentaje de acero debe estar entre 0.1 % y 8 %.');
  }

  const simetria    = chkSimetria.checked;
  const areaColumna = ancho * largo;                 // cm²
  const asRequerida = areaColumna * porc / 100;      // cm²

  // --- Alternativas para todos los diámetros ---
  const opciones = VARILLAS.map(v =>
    calcularParaVarilla(areaColumna, asRequerida, v, simetria)
  );

  // --- Opción elegida (manual o automática) ---
  const modoAuto = selVarilla.value === 'auto';
  const elegida  = modoAuto
    ? recomendar(opciones, asRequerida)
    : opciones.find(o => o.varilla.id === selVarilla.value);

  // --- Tarjeta de resultados ---
  divLista.innerHTML = [
    item('📐 Dimensiones de la columna', `${num(ancho, 0)} × ${num(largo, 0)} cm`),
    item('📏 Área de la sección',        `${num(areaColumna, 0)} cm²`),
    item('📊 Acero solicitado',          `${num(porc, 2)} %`),
    item('🔩 As requerida',              `${num(asRequerida)} cm²`),
    item('📌 Diámetro' + (modoAuto ? ' (recomendado)' : ''),
         elegida.varilla.etiqueta, true),
    item('🔩 Número de varillas',        `${elegida.cantidad} varillas`, true),
    item('📊 As proporcionada',          `${num(elegida.asProporcionada)} cm²`),
    item('📈 Porcentaje real de acero',  `${num(elegida.porcentajeReal)} %`)
  ].join('');

  dibujarCroquis(ancho, largo, elegida.cantidad);

  // --- Tabla de alternativas ---
  tbodyTabla.innerHTML = opciones.map(o => `
    <tr class="${o.varilla.id === elegida.varilla.id ? 'elegida' : ''}">
      <td>${o.varilla.etiqueta}</td>
      <td>${num(o.varilla.areaCm2)} cm²</td>
      <td>${o.cantidad}</td>
      <td>${num(o.asProporcionada)} cm²</td>
      <td>${num(o.porcentajeReal)} %</td>
    </tr>`).join('');

  secResultados.hidden = false;

  const registro = {
    fecha: new Date().toISOString(),
    ancho, largo, porcentaje: porc,
    diametro: elegida.varilla.etiqueta,
    cantidad: elegida.cantidad,
    asProporcionada: elegida.asProporcionada,
    porcentajeReal: elegida.porcentajeReal
  };
  ultimoCalculo = { registro, opciones };
  guardarEnHistorial(registro);

  guardarPreferencias();
  secResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarError(mensaje) {
  divError.textContent = mensaje;
  divError.hidden = false;
  secResultados.hidden = true;
}

function limpiar() {
  inpAncho.value = '';
  inpLargo.value = '';
  inpPorc.value  = '1';
  selVarilla.value = 'auto';
  chkSimetria.checked = true;
  divError.hidden = true;
  secResultados.hidden = true;
  inpAncho.focus();
}

/* ------------------------------------------------------------
   6) LOCALSTORAGE: historial y preferencias
   ------------------------------------------------------------ */

function leerHistorial() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL)) || [];
  } catch { return []; }
}

function guardarEnHistorial(registro) {
  const lista = leerHistorial();
  lista.unshift(registro);
  localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(lista.slice(0, 10))); // máx. 10
  pintarHistorial();
  publicarWidget();
}

function pintarHistorial() {
  const lista = leerHistorial();

  if (!lista.length) {
    ulHistorial.innerHTML = '<li class="vacio">Aún no hay cálculos guardados.</li>';
    return;
  }

  ulHistorial.innerHTML = lista.map((r, i) => {
    const f = new Date(r.fecha).toLocaleString('es-MX', {
      dateStyle: 'short', timeStyle: 'short'
    });
    return `<li>
      <div>
        <span class="fecha">${f}</span>
        Columna ${num(r.ancho, 0)}×${num(r.largo, 0)} cm ·
        ${num(r.porcentaje, 2)} % · <strong>${r.cantidad} varillas de ${r.diametro}</strong>
        (As = ${num(r.asProporcionada)} cm², ${num(r.porcentajeReal)} % real)
      </div>
      <button type="button" class="btn-enlace" data-compartir="${i}"
              aria-label="Compartir este cálculo">📤 Compartir</button>
    </li>`;
  }).join('');
}

function borrarHistorial() {
  if (!confirm('¿Eliminar todos los cálculos recientes?')) return;
  localStorage.removeItem(CLAVE_HISTORIAL);
  pintarHistorial();
  publicarWidget();
}

function guardarPreferencias() {
  localStorage.setItem(CLAVE_ULTIMO, JSON.stringify({
    porcentaje: inpPorc.value,
    varilla: selVarilla.value,
    simetria: chkSimetria.checked
  }));
}

function cargarPreferencias() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_ULTIMO));
    if (!p) return;
    if (p.porcentaje) inpPorc.value = p.porcentaje;
    if (p.varilla)    selVarilla.value = p.varilla;
    chkSimetria.checked = p.simetria !== false;
  } catch { /* preferencias no disponibles */ }
}

/* ------------------------------------------------------------
   7) COMPARTIR CONTENIDO CON OTRAS APLICACIONES (Web Share API)
   navigator.share abre el cuadro de diálogo de compartir del sistema
   operativo. Solo funciona en contextos seguros (HTTPS o localhost) y
   únicamente como respuesta a una acción del usuario (un clic).
   ------------------------------------------------------------ */

const TITULO_COMPARTIR = 'Cálculo de varillas para columna de concreto';

// 30 -> "30", 30.5 -> "30.5" (sin ceros sobrantes)
const limpio = v => String(+Number(v).toFixed(2));

// Dirección de la app que se comparte junto con el texto
const urlApp = () => new URL('./', location.href).href;

/** Resumen de un cálculo. Es también el formato que entiende
 *  interpretarTexto() cuando este texto se comparte de vuelta a la app. */
function textoResumen(r) {
  return [
    `Columna: ${limpio(r.ancho)} × ${limpio(r.largo)} cm`,
    `Acero solicitado: ${limpio(r.porcentaje)} %`,
    `Diámetro: ${r.diametro}`,
    `Número de varillas: ${r.cantidad}`,
    `As proporcionada: ${num(r.asProporcionada)} cm² (${num(r.porcentajeReal)} % real)`
  ].join('\n');
}

/** Contenido del archivo .txt: resumen + tabla de alternativas. */
function textoArchivo({ registro, opciones }) {
  const filas = opciones.map(o =>
    `  ${o.varilla.etiqueta.padEnd(7)} ${String(o.cantidad).padStart(3)} varillas   ` +
    `As = ${num(o.asProporcionada)} cm²   ${num(o.porcentajeReal)} % real`);

  return [
    'CALCULADORA DE VARILLAS PARA COLUMNAS DE CONCRETO',
    '',
    textoResumen(registro),
    '',
    'Alternativas por diámetro:',
    ...filas,
    '',
    'Cálculo preliminar: debe ser revisado por un profesional responsable.'
  ].join('\n');
}

/** Mensaje breve de estado (se oculta solo a los 4 s). */
let temporizadorEstado;
function avisar(mensaje, esError = false) {
  divEstado.textContent = mensaje;
  divEstado.classList.toggle('estado-error', esError);
  divEstado.hidden = false;
  clearTimeout(temporizadorEstado);
  temporizadorEstado = setTimeout(() => { divEstado.hidden = true; }, 4000);
}

/**
 * Comparte { title, text, url, files }. Debe llamarse directamente desde
 * un manejador de clic (navigator.share exige una acción del usuario).
 */
async function compartirContenido(datos) {
  if (navigator.share) {
    try {
      await navigator.share(datos);   // se resuelve cuando el uso compartido se realiza
      avisar('Contenido compartido.');
    } catch (error) {
      // AbortError: el usuario cerró el cuadro de diálogo sin elegir una app
      if (error.name !== 'AbortError') {
        console.error('Error al compartir el contenido', error);
        avisar('No se pudo compartir el contenido.', true);
      }
    }
    return;
  }

  // Respaldo para navegadores sin Web Share API: copiar el texto
  try {
    await navigator.clipboard.writeText(
      [datos.title, datos.text, datos.url].filter(Boolean).join('\n'));
    avisar('Tu navegador no admite compartir: el texto se copió al portapapeles.');
  } catch {
    avisar('Tu navegador no permite compartir ni copiar el contenido.', true);
  }
}

function compartirResultado() {
  if (!ultimoCalculo) return;
  compartirContenido({
    title: TITULO_COMPARTIR,
    text:  textoResumen(ultimoCalculo.registro),
    url:   urlApp()
  });
}

function compartirArchivo() {
  if (!ultimoCalculo) return;
  const archivo = new File([textoArchivo(ultimoCalculo)], 'calculo-varillas.txt',
                           { type: 'text/plain' });
  compartirContenido({ title: TITULO_COMPARTIR, files: [archivo] });
}

function compartirDeHistorial(indice) {
  const registro = leerHistorial()[indice];
  if (!registro) return;
  compartirContenido({
    title: TITULO_COMPARTIR,
    text:  textoResumen(registro),
    url:   urlApp()
  });
}

/** ¿Permite el navegador compartir archivos? (navigator.canShare) */
function puedeCompartirArchivos() {
  const prueba = new File(['prueba'], 'prueba.txt', { type: 'text/plain' });
  return Boolean(navigator.canShare && navigator.canShare({ files: [prueba] }));
}

/* ------------------------------------------------------------
   8) RECIBIR CONTENIDO COMPARTIDO (Web Share Target API)
   manifest.json declara "share_target": una vez instalada, el sistema
   ofrece esta app como destino al compartir texto, enlaces o archivos
   .txt. El Service Worker (sw.js) recibe el POST, guarda los datos en una
   caché y redirige a index.html?compartido=1; aquí se leen y se aplican.
   (El nombre de la caché y la clave deben coincidir con los de sw.js.)
   ------------------------------------------------------------ */

const CACHE_COMPARTIDO = 'calc-varillas-compartido';
const CLAVE_COMPARTIDO = './datos-compartidos.json';

const aNumero = s => parseFloat(String(s).replace(',', '.'));

/**
 * Busca en un texto libre las dimensiones, el porcentaje de acero y el
 * diámetro. Entiende el formato de textoResumen() y frases como
 * "columna de 30 x 40 cm, acero 2 %".
 */
function interpretarTexto(texto) {
  const r = {};

  const dim = texto.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|\*|por)\s*(\d+(?:[.,]\d+)?)/i);
  if (dim) { r.ancho = aNumero(dim[1]); r.largo = aNumero(dim[2]); }

  const porc = texto.match(/acero[^\d%]*(\d+(?:[.,]\d+)?)\s*%/i)
            || texto.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (porc) r.porcentaje = aNumero(porc[1]);

  const dia = texto.match(/di[aá]metro[^\d]*(\d+\s+\d+\/\d+|\d+\/\d+|\d+)\s*["”]/i);
  if (dia) {
    const id = dia[1].replace(/\s+/g, ' ');
    if (VARILLAS.some(v => v.id === id)) r.varilla = id;
  }

  return r;
}

/** Muestra el aviso con lo recibido. Todo se inserta como texto (textContent):
 *  el contenido compartido viene de fuera y no es de confianza. */
function mostrarRecibido(datos, estado) {
  const partes = [
    datos.title,
    datos.text,
    datos.url,
    datos.archivo && `Archivo: ${datos.archivo.nombre}`
  ].filter(Boolean);

  $('recibidoDetalle').textContent = partes.join('\n').slice(0, 500);
  $('recibidoEstado').textContent  = estado;
  divRecibido.hidden = false;
}

/** Rellena el formulario con lo recibido y calcula. */
function aplicarCompartido(datos) {
  const texto = [datos.archivo && datos.archivo.texto, datos.text, datos.title]
    .filter(Boolean).join('\n');
  const p = interpretarTexto(texto);

  if (!(p.ancho > 0 && p.largo > 0)) {
    mostrarRecibido(datos, 'No se encontraron las dimensiones de la columna. ' +
      'Prueba con algo como «Columna 30 x 40 cm, acero 2 %».');
    return;
  }

  inpAncho.value = p.ancho;
  inpLargo.value = p.largo;
  if (p.porcentaje > 0) inpPorc.value = p.porcentaje;
  if (p.varilla)        selVarilla.value = p.varilla;

  mostrarRecibido(datos, `Se cargaron los datos (${limpio(p.ancho)} × ${limpio(p.largo)} cm) ` +
                         'y se calculó el armado.');
  calcular();
}

/** Si la app se abrió desde "Compartir" (?compartido=1), lee lo que guardó el Service Worker. */
async function cargarCompartido() {
  if (!new URLSearchParams(location.search).has('compartido')) return;
  history.replaceState(null, '', location.pathname);   // quita ?compartido de la dirección

  try {
    const cache = await caches.open(CACHE_COMPARTIDO);
    const respuesta = await cache.match(CLAVE_COMPARTIDO);
    if (!respuesta) return;

    const datos = await respuesta.json();
    await cache.delete(CLAVE_COMPARTIDO);
    aplicarCompartido(datos);
  } catch (error) {
    console.warn('No se pudo leer el contenido compartido:', error);
  }
}

/* ------------------------------------------------------------
   9) WIDGET DE WINDOWS 11 (panel de widgets)
   El Service Worker (sw.js) dibuja el widget declarado en manifest.json,
   pero no puede leer localStorage: por eso aquí se publica, ya listo
   para la plantilla widgets/varillas-template.json, el último cálculo
   del historial. (El nombre de la caché y la clave deben coincidir
   con los de sw.js.)
   ------------------------------------------------------------ */

const CACHE_WIDGET = 'calc-varillas-widget';
const CLAVE_WIDGET = './widget-datos.json';

function datosWidget() {
  const lista = leerHistorial();
  const r = lista[0];

  if (!r) {
    return { hayCalculo: false, sinCalculo: true, fecha: '', columna: '', armado: '', detalle: '', guardados: '' };
  }

  return {
    hayCalculo: true,
    sinCalculo: false,
    fecha: new Date(r.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
    columna: `Columna ${limpio(r.ancho)} × ${limpio(r.largo)} cm · acero ${limpio(r.porcentaje)} %`,
    armado: `${r.cantidad} varillas de ${r.diametro}`,
    detalle: `As = ${num(r.asProporcionada)} cm² (${num(r.porcentajeReal)} % real)`,
    guardados: lista.length === 1 ? '1 cálculo guardado' : `${lista.length} cálculos guardados`
  };
}

/** Guarda los datos del widget y avisa al Service Worker para que lo vuelva a dibujar. */
async function publicarWidget() {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return;
  try {
    const cache = await caches.open(CACHE_WIDGET);
    await cache.put(CLAVE_WIDGET, new Response(JSON.stringify(datosWidget()), {
      headers: { 'Content-Type': 'application/json' }
    }));
    const registro = await navigator.serviceWorker.ready;
    if (registro.active) registro.active.postMessage({ tipo: 'widgets-actualizar' });
  } catch { /* sin caché o sin Service Worker: el widget conserva sus datos anteriores */ }
}

/** Los botones del widget abren la app con ?accion=nuevo o ?accion=historial. */
function atenderAccionWidget() {
  const accion = new URLSearchParams(location.search).get('accion');
  if (!accion) return;
  history.replaceState(null, '', location.pathname);   // quita ?accion de la dirección

  if (accion === 'nuevo') {
    inpAncho.focus();
    inpAncho.select();
  } else if (accion === 'historial') {
    $('seccionHistorial').scrollIntoView({ block: 'start' });   // salto directo, como un ancla
  }
}

/* ------------------------------------------------------------
   10) INICIALIZACIÓN
   ------------------------------------------------------------ */

// Llena el selector de diámetros desde el catálogo
VARILLAS.forEach(v => {
  const op = document.createElement('option');
  op.value = v.id;
  op.textContent = `${v.etiqueta}  (${v.areaCm2.toFixed(2)} cm²)`;
  selVarilla.appendChild(op);
});

formulario.addEventListener('submit', calcular);
$('btnLimpiar').addEventListener('click', limpiar);
$('btnBorrarHistorial').addEventListener('click', borrarHistorial);

// Compartir
btnCompartir.addEventListener('click', compartirResultado);
btnCompartirArchivo.addEventListener('click', compartirArchivo);
btnCompartirArchivo.hidden = !puedeCompartirArchivos();
ulHistorial.addEventListener('click', e => {
  const boton = e.target.closest('[data-compartir]');
  if (boton) compartirDeHistorial(Number(boton.dataset.compartir));
});
$('btnCerrarRecibido').addEventListener('click', () => { divRecibido.hidden = true; });

cargarPreferencias();
pintarHistorial();
cargarCompartido();   // después de cargar preferencias, para no pisar lo recibido
atenderAccionWidget();
publicarWidget();

/* ------------------------------------------------------------
   11) PWA: Service Worker e instalación
   ------------------------------------------------------------ */

// Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('No se pudo registrar el Service Worker:', err));
  });
}

// Botón "Instalar aplicación"
let promptInstalacion = null;
const btnInstalar = $('btnInstalar');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();               // evita el aviso automático del navegador
  promptInstalacion = e;
  btnInstalar.hidden = false;       // muestra nuestro propio botón
});

btnInstalar.addEventListener('click', async () => {
  if (!promptInstalacion) return;
  promptInstalacion.prompt();
  await promptInstalacion.userChoice;
  promptInstalacion = null;
  btnInstalar.hidden = true;
});

// Si ya quedó instalada, ocultamos el botón
window.addEventListener('appinstalled', () => { btnInstalar.hidden = true; });

// La superposición de controles de ventana (barra de título propia)
// se maneja en wco.js, que se carga en <head>.
