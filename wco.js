/* ============================================================
   Superposición de controles de ventana (Window Controls Overlay)
   ------------------------------------------------------------
   Con display_override "window-controls-overlay" (manifest.json)
   la app instalada dibuja su propia barra de título. Este script
   marca <html class="wco"> mientras exista esa barra; style.css
   usa esa clase para convertir el encabezado en la barra de título.

   Se carga en <head> (sin defer) para que la clase esté puesta antes
   del primer pintado y no haya un salto de diseño al abrir la app.
   ============================================================ */

(function () {
  'use strict';

  const raiz = document.documentElement;

  // Limita cuántas veces se ejecuta una función: geometrychange se
  // dispara muchísimas veces mientras se redimensiona la ventana
  const debounce = (fn, espera) => {
    let temporizador;
    return (...args) => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => fn(...args), espera);
    };
  };

  // Elemento de prueba: su alto es env(titlebar-area-height), que el
  // navegador define (> 0) solo cuando hay una barra de título propia
  const sonda = document.createElement('div');
  sonda.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;height:env(titlebar-area-height,0px)';

  const hayBarraPropia = () => {
    // App instalada con la superposición visible
    const api = navigator.windowControlsOverlay;
    if (api && api.visible) return true;

    // Simulación de DevTools (Application > Manifest): define env() pero
    // no activa la API ni la media query display-mode
    raiz.appendChild(sonda);
    const alto = sonda.getBoundingClientRect().height;
    sonda.remove();
    return alto > 0;
  };

  const actualizar = () => raiz.classList.toggle('wco', hayBarraPropia());

  actualizar();

  // El usuario puede mostrar/ocultar la barra de título o redimensionar
  // la ventana: se vuelve a comprobar (con debounce, como recomienda Microsoft)
  if ('windowControlsOverlay' in navigator) {
    navigator.windowControlsOverlay.addEventListener('geometrychange', debounce(actualizar, 100));
  }
})();
