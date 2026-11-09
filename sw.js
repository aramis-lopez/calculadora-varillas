/* ============================================================
   Service Worker — Calculadora de Varillas
   ------------------------------------------------------------
   Estrategia:
   · install  -> precachea los archivos principales.
   · activate -> borra cachés de versiones anteriores.
   · fetch    -> "network first" para el HTML (así se ve la
                 versión nueva en cuanto hay conexión) y
                 "cache first" para el resto de recursos.

   👉 Al publicar cambios, sube el número de VERSION.
   ============================================================ */

const VERSION = 'v8';
const CACHE   = `calc-varillas-${VERSION}`;

// Contenido recibido desde otras apps (share_target en manifest.json).
// Va en su propia caché para que no se borre al cambiar de VERSION.
// El nombre y la clave deben coincidir con los de app.js.
const CACHE_COMPARTIDO = 'calc-varillas-compartido';
const CLAVE_COMPARTIDO = './datos-compartidos.json';
const RUTA_COMPARTIR   = new URL('./compartido', self.registration.scope).pathname;  // = share_target.action

// Widget de Windows: los datos que muestra los publica la página (app.js) en
// esta caché. Va aparte para que no se borre al cambiar de VERSION.
// El nombre y la clave deben coincidir con los de app.js.
const CACHE_WIDGET = 'calc-varillas-widget';
const CLAVE_WIDGET = './widget-datos.json';
const TAG_WIDGET   = 'calc-varillas';   // = widgets[].tag en manifest.json

// Archivos que forman el "esqueleto" de la aplicación
const ARCHIVOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './wco.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './widgets/varillas-template.json',
  './widgets/varillas-data.json'
];

/* ---------- Instalación: precache ---------- */
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' ignora la caché HTTP del navegador: si el servidor envía
      // "max-age", sin esto el precache guardaría copias viejas de los archivos
      .then(cache => cache.addAll(ARCHIVOS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())   // activa la nueva versión enseguida
  );
});

/* ---------- Activación: limpieza de cachés viejas ---------- */
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(claves => Promise.all(
        claves.filter(c => c !== CACHE && c !== CACHE_COMPARTIDO && c !== CACHE_WIDGET).map(c => caches.delete(c))
      ))
      .then(() => self.clients.claim())
      .then(actualizarWidgets)   // evita widgets vacíos tras actualizar el service worker
  );
});

/* ---------- Destino de "Compartir" (Web Share Target) ----------
   Otra app comparte contenido con esta PWA: el sistema envía un POST
   multipart/form-data a RUTA_COMPARTIR. Se guarda lo recibido (así
   funciona también sin conexión) y se redirige a la app, que lo lee. */
async function recibirCompartido(req) {
  try {
    const formulario = await req.formData();
    const archivo = formulario.get('archivo');

    const recibido = {
      title: formulario.get('title') || '',
      text:  formulario.get('text')  || '',
      url:   formulario.get('url')   || '',
      archivo: (archivo && typeof archivo !== 'string' && archivo.size > 0)
        ? { nombre: archivo.name, texto: (await archivo.text()).slice(0, 20000) }
        : null
    };

    const cache = await caches.open(CACHE_COMPARTIDO);
    await cache.put(CLAVE_COMPARTIDO, new Response(JSON.stringify(recibido), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    console.warn('No se pudo procesar el contenido compartido:', error);
  }

  // 303: el navegador continúa con una petición GET a la app
  return Response.redirect(new URL('./index.html?compartido=1', self.registration.scope).href, 303);
}

/* ---------- Intercepción de peticiones ---------- */
self.addEventListener('fetch', evento => {
  const req = evento.request;

  // Contenido compartido desde otra aplicación (POST)
  if (req.method === 'POST') {
    const url = new URL(req.url);
    if (url.origin === self.location.origin && url.pathname === RUTA_COMPARTIR) {
      evento.respondWith(recibirCompartido(req));
      return;
    }
  }

  // Solo manejamos peticiones GET del mismo origen
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const esNavegacion = req.mode === 'navigate';

  if (esNavegacion) {
    // Red primero; si no hay conexión, servimos el index cacheado
    evento.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copia));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto de recursos: caché primero, con actualización en segundo plano
  evento.respondWith(
    caches.match(req).then(cacheado => {
      const desdeRed = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cacheado);

      return cacheado || desdeRed;
    })
  );
});

/* ---------- Widget de Windows 11 (panel de widgets) ----------
   manifest.json declara el widget (widgets[]): la plantilla de tarjeta adaptable
   y unos datos por defecto. Windows no lo dibuja solo: aquí se le envía plantilla
   + datos con self.widgets.updateByTag().
   El historial de cálculos vive en localStorage, que el Service Worker no puede
   leer; por eso app.js copia el último cálculo a CACHE_WIDGET cada vez que cambia
   y nos avisa con un mensaje. */

// Lee un archivo de la caché del Service Worker y, si no está, de la red
async function leerTexto(url) {
  const guardado = await caches.match(url);
  return (guardado || await fetch(url)).text();
}

// Dibuja el widget con su plantilla y los últimos datos publicados por la página
async function dibujarWidget(widget) {
  const def = widget && widget.definition ? widget.definition : {};
  const plantilla = await leerTexto(new URL(def.msAcTemplate || 'widgets/varillas-template.json', self.registration.scope).href);

  const cache = await caches.open(CACHE_WIDGET);
  const publicados = await cache.match(CLAVE_WIDGET);
  const datos = publicados
    ? await publicados.text()
    : await leerTexto(new URL(def.data || 'widgets/varillas-data.json', self.registration.scope).href);

  await self.widgets.updateByTag(def.tag || TAG_WIDGET, { template: plantilla, data: datos });
}

// Vuelve a dibujar el widget si el usuario ya lo agregó. Nunca lanza error:
// se usa dentro de 'activate' y un fallo ahí dejaría el Service Worker sin activar.
async function actualizarWidgets() {
  if (!self.widgets) return;   // navegador o sistema sin soporte de widgets
  try {
    const widget = await self.widgets.getByTag(TAG_WIDGET);
    if (widget) await dibujarWidget(widget);
  } catch (error) {
    console.warn('No se pudo actualizar el widget:', error);
  }
}

// El usuario agregó el widget desde el panel: hay que dibujarlo por primera vez
self.addEventListener('widgetinstall', evento => {
  evento.waitUntil(dibujarWidget(evento.widget).catch(error => console.warn('No se pudo dibujar el widget:', error)));
});

// El panel reanuda los widgets después de haberlos suspendido
self.addEventListener('widgetresume', evento => {
  evento.waitUntil(actualizarWidgets());
});

// La página avisa de que el historial cambió
self.addEventListener('message', evento => {
  if (evento.data && evento.data.tipo === 'widgets-actualizar') evento.waitUntil(actualizarWidgets());
});

// Abre (o enfoca) la app. Con una ruta, navega ahí aunque ya haya una ventana abierta.
async function abrirApp(ruta) {
  const destino = new URL(ruta || './', self.registration.scope).href;
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const ventana = ventanas.find(c => c.url.startsWith(self.registration.scope));

  if (ventana) {
    let objetivo = ventana;
    if (ruta) {
      try { objetivo = await ventana.navigate(destino); } catch (_) { objetivo = null; }
    }
    if (objetivo) {
      try { await objetivo.focus(); return; } catch (_) { /* sin gesto del usuario */ }
    }
  }
  await self.clients.openWindow(destino);
}

// Botones de la tarjeta: 'verb' de cada Action.Execute en widgets/varillas-template.json
self.addEventListener('widgetclick', evento => {
  switch (evento.action) {
    case 'nuevo':
      evento.waitUntil(abrirApp('./index.html?accion=nuevo'));
      break;
    case 'historial':
      evento.waitUntil(abrirApp('./index.html?accion=historial'));
      break;
  }
});
