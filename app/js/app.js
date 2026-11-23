/*
 * CloroSeguro: interfaz
 * ---------------------
 * Lee lo que el usuario escribe, llama al módulo de química (quimica.js)
 * y muestra la dosis, los pasos, los avisos y los cálculos.
 * Aquí no hay fórmulas químicas: todas viven en quimica.js.
 */
(function () {
  'use strict';

  const Q = window.Quimica;
  const N = Q.NORMAS;
  const L_GAL = Q.UNIDADES.L_POR_GALON;

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  /* ---------- Formato de números ---------- */
  const num = (n, dec = 0) =>
    Number(n).toLocaleString('es-DO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const numAuto = (n) => (Number.isInteger(n) ? num(n) : num(n, 1));
  const valorRadio = (name) => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  };
  const leerNumero = (id) => parseFloat($('#' + id).value);

  function formatoML(mL) {
    if (mL >= 1000) return { cantidad: num(mL / 1000, 2), unidad: 'L' };
    if (mL < 10) return { cantidad: num(mL, 1), unidad: 'mL' };
    return { cantidad: num(mL), unidad: 'mL' };
  }
  function formatoG(g) {
    if (g >= 1000) return { cantidad: num(g / 1000, 2), unidad: 'kg' };
    if (g < 10) return { cantidad: num(g, 1), unidad: 'g' };
    return { cantidad: num(g), unidad: 'g' };
  }
  // Tiempos de espera: se redondean hacia arriba de 5 en 5 minutos (mejor esperar de más)
  function formatoTiempo(min) {
    const m = Math.ceil(min / 5 - 1e-9) * 5;
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  function formatoConc(c) {
    if (c < 0.1) return num(c, 2);
    return c < 10 ? num(c, 1) : num(c);
  }
  function textoVolumen(L) {
    const gal = L / L_GAL;
    if (L < 100) return `${num(L, 1)} litros (${num(gal, 1)} gal)`;
    return `${num(L)} litros (${num(gal)} gal)`;
  }
  function textoAgua(L) {
    const gal = L / L_GAL;
    if (L < 10) return `${num(L, 1)} litros`;
    return `${num(L)} litros (${num(gal)} galones)`;
  }

  /* ---------- Vista "Calcular" ---------- */

  function leerEstado() {
    const s = {
      modo: valorRadio('modo'),
      urgencia: valorRadio('urgencia'),
      modoVol: valorRadio('modoVol'),
      apariencia: valorRadio('apariencia'),
      pHDesconocido: $('#pHDesconocido').checked,
      temp: leerNumero('temp'),
      volumenL: NaN,
      detalleVol: null,
      errores: [],
    };
    s.pH = s.pHDesconocido ? 7.5 : leerNumero('pH');

    if (s.modoVol === 'comun') {
      s.volumenL = parseFloat(valorRadio('presetVol'));
      s.detalleVol = { tipo: 'preset' };
    } else if (s.modoVol === 'capacidad') {
      const v = leerNumero('volValor');
      const u = $('#volUnidad').value;
      s.volumenL = v > 0 ? Q.aLitros(v, u) : NaN;
      s.detalleVol = { tipo: 'capacidad', v, u };
    } else {
      const u = $('#dimUnidad').value;
      const m = (id) => Q.aMetros(leerNumero(id), u);
      if ($('#forma').value === 'cilindro') {
        const d = m('diam'), h = m('altoC');
        s.volumenL = d > 0 && h > 0 ? Q.volumenCilindro(d, h) : NaN;
        s.detalleVol = { tipo: 'cilindro', d, h };
      } else {
        const l = m('largo'), a = m('ancho'), h = m('altoR');
        s.volumenL = l > 0 && a > 0 && h > 0 ? Q.volumenRectangular(l, a, h) : NaN;
        s.detalleVol = { tipo: 'rectangular', l, a, h };
      }
    }
    if (!(s.volumenL > 0)) s.errores.push('Escribe cuánta agua es (un número mayor que cero).');

    const forma = valorRadio('formaProd');
    let porcentaje;
    if (forma === 'liquido') {
      const v = valorRadio('pctLiq');
      porcentaje = v === 'otro' ? leerNumero('pctLiqOtro') : parseFloat(v);
      if (!(porcentaje >= 0.1 && porcentaje <= 20))
        s.errores.push('El cloro líquido de casa va de 0.1 % a 15 %. Revisa el porcentaje de la etiqueta.');
    } else {
      const v = valorRadio('pctGran');
      porcentaje = v === 'otro' ? leerNumero('pctGranOtro') : parseFloat(v);
      if (!(porcentaje >= 1 && porcentaje <= 100))
        s.errores.push('El porcentaje del granulado debe estar entre 1 % y 100 %.');
    }
    s.producto = { forma, porcentaje, base: forma === 'liquido' ? $('#baseLiq').value : 'disponible' };
    return s;
  }

  function sincronizarControles(s) {
    $('#bloqueUrgencia').hidden = s.modo !== 'choque';
    $('#pasoAgua').hidden = s.modo === 'choque';
    $('#volComun').hidden = s.modoVol !== 'comun';
    $('#volCapacidad').hidden = s.modoVol !== 'capacidad';
    $('#volMedir').hidden = s.modoVol !== 'medir';
    $('#dimsCilindro').hidden = $('#forma').value !== 'cilindro';
    $('#dimsRect').hidden = $('#forma').value !== 'rectangular';
    $('#prodLiquido').hidden = s.producto.forma !== 'liquido';
    $('#prodGranulado').hidden = s.producto.forma !== 'granulado';
    $('#campoPctLiqOtro').hidden = valorRadio('pctLiq') !== 'otro';
    $('#campoPctGranOtro').hidden = valorRadio('pctGran') !== 'otro';
    $('#pH').disabled = s.pHDesconocido;
    $('#pHSalida').textContent = num(s.pH, 1);
    $('#tempSalida').textContent = `${s.temp} °C`;
  }

  let ultimaBarra = null;

  function mostrarError(errores) {
    $('#rCeja').textContent = 'Faltan datos';
    $('#rCantidad').textContent = '—';
    $('#rUnidad').textContent = '';
    $('#rCasera').textContent = errores[0];
    $('#rDe').textContent = '';
    $('#rConc').textContent = '—';
    $('#rTiempo').textContent = '—';
    $('#rHOCl').textContent = '—';
    $('#rPasos').innerHTML = '';
    $('#rAvisos').innerHTML = '';
    $('#rMSP').hidden = true;
    $('#rCalculosLista').innerHTML = '';
    ultimaBarra = null;
    actualizarBarra();
  }

  function aviso(tipo, titulo, texto) {
    return `<div class="aviso aviso--${tipo}"><b>${titulo}</b>${texto}</div>`;
  }

  function actualizarCalculo() {
    const s = leerEstado();
    sincronizarControles(s);
    if (s.errores.length) return mostrarError(s.errores);

    const esLiquido = s.producto.forma === 'liquido';
    const potabilizar = s.modo === 'potabilizar';
    const contacto = Q.tiempoContacto(s.pH, s.temp);

    let cObj, tiempoMin, razon;
    if (potabilizar) {
      cObj = s.apariencia === 'clara' ? N.dosisClara : N.dosisTurbia;
      razon = s.apariencia === 'clara' ? 'agua clara' : 'agua turbia';
      tiempoMin = contacto.minutos;
    } else {
      const ch = N.choque[s.urgencia];
      cObj = ch.mgL;
      razon = `desinfección del tanque por ${ch.horas} h`;
      tiempoMin = ch.horas * 60;
    }

    const d = Q.calcularDosis(s.volumenL, cObj, s.producto);
    const pctTexto = numAuto(s.producto.porcentaje);

    // --- La receta ---
    let cantidad, casera, cantidadTexto;
    if (esLiquido) {
      cantidad = formatoML(d.mL);
      casera = Q.medidaCasera(d.mL).texto;
      cantidadTexto = `${cantidad.cantidad} ${cantidad.unidad}`;
      $('#rCasera').textContent = `≈ ${casera}`;
      $('#rDe').textContent = `de cloro al ${pctTexto} % para ${textoVolumen(s.volumenL)}`;
    } else {
      cantidad = formatoG(d.gramos);
      cantidadTexto = `${cantidad.cantidad} ${cantidad.unidad}`;
      $('#rCasera').textContent = 'Pésalo en una balanza de cocina';
      $('#rDe').textContent = `de cloro granulado al ${pctTexto} % para ${textoVolumen(s.volumenL)}`;
    }
    $('#rCeja').textContent = potabilizar ? 'Échale al agua' : 'Para desinfectar el tanque';
    $('#rCantidad').textContent = cantidad.cantidad;
    $('#rUnidad').textContent = cantidad.unidad;
    $('#rConc').textContent = `${formatoConc(cObj)} mg/L`;
    $('#rTiempo').textContent = formatoTiempo(tiempoMin);
    $('#rHOCl').textContent = `${Math.round(contacto.fraccion * 100)} %`;

    // --- Pasos ---
    const pequeno = s.volumenL <= 25;
    const pasos = [];
    if (potabilizar) {
      if (esLiquido) {
        pasos.push(d.mL < 2.5
          ? `Echa <b>${casera}</b> de cloro con un gotero.`
          : `Mide <b>${cantidadTexto}</b> de cloro (${casera}). Usa una jeringa sin aguja o cucharas de medir; la tapita de la botella no es una medida exacta.`);
      } else {
        pasos.push(`Pesa <b>${cantidadTexto}</b> de cloro granulado.`);
        pasos.push('Disuélvelo primero en un cubo con agua. Espera a que se asiente lo que no se disuelve y echa solo el líquido.');
      }
      pasos.push(pequeno
        ? 'Échalo en el recipiente, tápalo y agítalo para que se mezcle.'
        : 'Échalo cuando el tinaco se esté llenando, o revuelve con un palo limpio para que se mezcle.');
      pasos.push(`Tápalo y espera al menos <b>${formatoTiempo(tiempoMin)}</b> antes de usar el agua.`);
      pasos.push('Al final el agua debe oler un poquito a cloro. Si no huele a nada, repite la dosis y espera 15 minutos más.');
      pasos.push('Si tienes un kit de piscina (DPD), a los 30 minutos debe marcar entre 0.5 y 2 mg/L de cloro libre.');
      pasos.push('Cada vez que entre agua nueva, vuelve a calcular y a clorar.');
    } else {
      const ch = N.choque[s.urgencia];
      pasos.push('Vacía el tanque y friega paredes, fondo y tapa con cepillo, agua y jabón. Enjuaga hasta que no quede espuma.');
      pasos.push(`Llénalo hasta una cuarta parte con agua limpia, échale <b>${cantidadTexto}</b> de cloro${esLiquido ? ` (${casera})` : ' disuelto en un cubo'} y termina de llenarlo.`);
      pasos.push(`Tápalo y déjalo reposar <b>${ch.horas} horas</b>. Esa agua queda a ${ch.mgL} mg/L: no es para tomar.`);
      pasos.push('Vacíalo completo, lejos de plantas y animales. Llénalo con agua limpia, espera 30 minutos y vuelve a vaciarlo.');
      pasos.push('Llénalo otra vez y clora esa agua con la opción "Clorar agua para usar".');
    }
    $('#rPasos').innerHTML = pasos.map((p) => `<li><span>${p}</span></li>`).join('');

    // --- Avisos ---
    const avisos = [];
    if (potabilizar && s.apariencia === 'muy-turbia') {
      avisos.push(aviso('warn', 'Agua muy turbia: primero aclárala',
        'La tierra gasta el cloro y protege a los microbios. Déjala reposar unas horas o cuélala con un paño limpio, pasa el agua clara a otro recipiente y aplica esta dosis.'));
    }
    if (potabilizar && s.pH > 9) {
      avisos.push(aviso('bad', `Con pH ${num(s.pH, 1)} el cloro casi no actúa`,
        `Solo el ${num(contacto.fraccion * 100, 1)} % del cloro queda como HOCl. Mejor hierve el agua, como recomienda Salud Pública.`));
    } else if (potabilizar && s.pH > N.pHRef) {
      avisos.push(aviso('warn', 'pH alto: hay que esperar más',
        `Con pH ${num(s.pH, 1)} solo el ${num(contacto.fraccion * 100, 0)} % del cloro está como HOCl (el que desinfecta). Por eso la espera sube a ${formatoTiempo(tiempoMin)}.`));
    }
    if (potabilizar && contacto.aguaFria) {
      avisos.push(aviso('info', 'Agua fría',
        'Por debajo de 18 °C el cloro reacciona más lento, por eso se duplicó el tiempo de espera.'));
    }
    if (esLiquido && d.pctNaOCl >= 10) {
      avisos.push(aviso('warn', 'Cloro concentrado',
        'Usa guantes y lentes. Si te salpica, lava con mucha agua.'));
    }
    if (!potabilizar) {
      avisos.push(aviso('bad', 'Ventila y no mezcles',
        'Abre bien el área y nunca mezcles el cloro con vinagre, ácidos ni amoníaco: se forman gases tóxicos.'));
    }
    $('#rAvisos').innerHTML = avisos.join('');

    // --- Comparación con la regla de Salud Pública ---
    const mspVisible = potabilizar && esLiquido;
    $('#rMSP').hidden = !mspVisible;
    if (mspVisible) {
      const cMSP = Q.concentracionReglaMSP(s.producto);
      const nivel = Q.evaluarConcentracion(cMSP);
      const etiquetas = {
        bajo: ['warn', 'Se queda corta'],
        ok: ['ok', 'Funciona'],
        alto: ['warn', 'Justo en el límite'],
        excesivo: ['bad', 'Se pasa'],
      };
      const [clase, texto] = etiquetas[nivel];
      const gotas = Math.round((N.gotasPorGalonMSP * s.volumenL) / L_GAL);
      let t = `<span class="etiqueta etiqueta--${clase}">${texto}</span> Salud Pública recomienda 5 gotas de cloro al 5 % por galón. Con tu cloro al ${pctTexto} %, esa regla deja el agua a <b>${formatoConc(cMSP)} mg/L</b>`;
      t += nivel === 'excesivo' ? ', más que el valor guía de la OMS (5 mg/L).' : '.';
      t += gotas > 200
        ? ` Para ${textoVolumen(s.volumenL)} serían ${num(gotas)} gotas, y nadie cuenta eso. Por eso aquí se calcula en mililitros.`
        : ` Para tu recipiente serían unas ${num(gotas)} gotas.`;
      $('#rMSPTexto').innerHTML = t;
    }

    // --- Cálculos paso a paso ---
    $('#rCalculosLista').innerHTML = construirCalculos(s, d, cObj, razon, contacto, tiempoMin);

    ultimaBarra = { texto: cantidadTexto, resto: `de cloro · espera ${formatoTiempo(tiempoMin)}` };
    actualizarBarra();
  }

  function construirCalculos(s, d, cObj, razon, contacto, tiempoMin) {
    const items = [];
    const L = s.volumenL;
    const dv = s.detalleVol;

    // 1. Volumen
    let fVol;
    if (dv.tipo === 'cilindro') {
      fVol = `V = π · (d/2)² · h\n= π · (${num(dv.d, 3)} m / 2)² · ${num(dv.h, 3)} m\n= ${num(L / 1000, 3)} m³ = ${num(L, 1)} L`;
    } else if (dv.tipo === 'rectangular') {
      fVol = `V = largo · ancho · h\n= ${num(dv.l, 3)} m · ${num(dv.a, 3)} m · ${num(dv.h, 3)} m\n= ${num(L / 1000, 3)} m³ = ${num(L, 1)} L`;
    } else if (dv.tipo === 'capacidad' && dv.u === 'gal') {
      fVol = `V = ${numAuto(dv.v)} gal × 3.785 L/gal = ${num(L, 1)} L`;
    } else {
      fVol = `V = ${num(L, 1)} L (${num(L / L_GAL, 1)} gal)`;
    }
    items.push(`<b>Volumen de agua</b><span class="formula">${fVol}</span>`);

    // 2. Concentración del producto
    if (d.forma === 'liquido') {
      const linea1 = s.producto.base === 'disponible'
        ? `% NaOCl = % disponible ÷ (M Cl₂ / M NaOCl)\n= ${numAuto(s.producto.porcentaje)} ÷ 0.9525 = ${num(d.pctNaOCl, 2)} %`
        : `% Cl₂ disponible = % NaOCl × (M Cl₂ / M NaOCl)\n= ${numAuto(s.producto.porcentaje)} × (70.906 / 74.442) = ${num(d.pctDisponible, 2)} %`;
      items.push(`<b>Concentración del cloro de la botella (C₁)</b><span class="formula">${linea1}\nρ ≈ 1 + 0.015 × ${num(d.pctNaOCl, 2)} = ${num(d.densidad, 3)} g/mL\nC₁ = ${num(d.pctDisponible, 2)}/100 × ${num(d.densidad, 3)} g/mL × 10⁶\n   = ${num(d.mgPorL)} mg/L de cloro disponible\n[NaOCl] = ${num(d.molaridadNaOCl, 3)} mol/L</span>`);
    } else {
      items.push(`<b>Cloro por gramo de producto</b><span class="formula">${numAuto(s.producto.porcentaje)} % × 1000 mg/g = ${num(d.mgClPorGramo)} mg de Cl₂ por gramo\nCa(OCl)₂ puro: 2 × 70.906 / 142.98 = ${num(d.pctTeoricoPuro, 1)} %</span>`);
    }

    // 3. Dosis
    if (d.forma === 'liquido') {
      items.push(`<b>Dilución (meta C₂ = ${formatoConc(cObj)} mg/L, ${razon})</b><span class="formula">C₁ · V₁ = C₂ · (V_agua + V₁)\nV₁ = C₂ · V_agua / (C₁ − C₂)\n   = ${formatoConc(cObj)} × ${num(L, 1)} / (${num(d.mgPorL)} − ${formatoConc(cObj)})\n   = ${num(d.mL / 1000, 5)} L = ${num(d.mL, 1)} mL</span>`);
    } else {
      items.push(`<b>Masa de producto (meta ${formatoConc(cObj)} mg/L, ${razon})</b><span class="formula">m = C₂ · V / (mg de Cl₂ por g)\n= ${formatoConc(cObj)} mg/L × ${num(L, 1)} L / ${num(d.mgClPorGramo)} mg/g\n= ${num(d.gramos, 1)} g</span>`);
    }

    // 4. Equilibrio y tiempo
    if (s.modo === 'potabilizar') {
      const T = s.temp + 273.15;
      items.push(`<b>Equilibrio HOCl ⇌ H⁺ + OCl⁻</b><span class="formula">T = ${s.temp} + 273.15 = ${num(T, 2)} K\npKa = 3000/T − 10.0686 + 0.0253·T = ${num(contacto.pKa, 2)}\nα(HOCl) = 1 / (1 + 10^(pH − pKa))\n        = 1 / (1 + 10^(${num(s.pH, 1)} − ${num(contacto.pKa, 2)})) = ${num(contacto.fraccion * 100, 1)} %</span>`);
      items.push(`<b>Tiempo de contacto</b><span class="formula">t = 30 min × máx(1, α(pH 8) / α(pH))\n  = 30 × máx(1, ${num(contacto.fraccionRef, 3)} / ${num(contacto.fraccion, 3)})${contacto.aguaFria ? ' × 2 (agua fría)' : ''}\n  = ${num(tiempoMin, 0)} min</span>`);
    } else {
      items.push(`<b>Tiempo de contacto</b><span class="formula">${formatoConc(cObj)} mg/L durante ${num(tiempoMin / 60)} h\nC·t = ${num(cObj * tiempoMin)} mg·min/L</span>`);
    }
    return items.map((i) => `<li>${i}</li>`).join('');
  }

  /* ---------- Barra inferior (celular) ---------- */
  let vistaActual = 'calcular';
  let resultadoVisible = false;
  function actualizarBarra() {
    const barra = $('#barra');
    if (ultimaBarra) {
      $('#bDosis').textContent = ultimaBarra.texto;
      $('#bResto').textContent = ultimaBarra.resto;
    }
    barra.hidden = vistaActual !== 'calcular' || resultadoVisible || !ultimaBarra;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => {
      resultadoVisible = entradas[0].isIntersecting;
      actualizarBarra();
    }, { threshold: 0.12 }).observe($('#resultado'));
  }
  const reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('#bIr').addEventListener('click', () => {
    $('#resultado').scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- Vista "Ya le eché cloro" ---------- */
  const ML_POR = { gotas: 0.05, cucharadita: 5, cucharada: 15, taza: 240, mL: 1, L: 1000 };

  function actualizarVerificacion() {
    const vol = leerNumero('vVol');
    const cant = leerNumero('vCant');
    const pct = leerNumero('vPct');
    const estado = $('#vEstado');
    const consejo = $('#vConsejo');
    estado.className = 'estado';

    if (!(vol > 0) || !(cant >= 0) || !(pct >= 0.1 && pct <= 20)) {
      $('#vConc').textContent = '—';
      $('#vAguja').style.left = '0%';
      estado.textContent = 'Revisa los datos';
      consejo.textContent = 'La cantidad de agua debe ser mayor que cero y el cloro estar entre 0.1 % y 15 %.';
      return;
    }

    const V = Q.aLitros(vol, $('#vVolUnidad').value);
    const mL = cant * ML_POR[$('#vCantUnidad').value];
    const producto = { forma: 'liquido', porcentaje: pct, base: $('#vBase').value };
    const c = Q.concentracionResultante(V, mL, producto);
    const objetivo = $('#vApariencia').value === 'clara' ? N.dosisClara : N.dosisTurbia;
    const nivel = Q.evaluarConcentracion(c);

    $('#vConc').textContent = formatoConc(c);
    $('#vAguja').style.left = `${(Math.min(c, 8) / 8) * 100}%`;

    if (nivel === 'bajo') {
      const falta = Q.calcularDosis(V, objetivo, producto).mL - mL;
      const f = formatoML(falta);
      estado.classList.add('estado--warn');
      estado.textContent = c === 0 ? 'No tiene cloro' : 'Le falta cloro';
      consejo.innerHTML = `Para llegar a ${formatoConc(objetivo)} mg/L échale <b>${f.cantidad} ${f.unidad} más</b> (${Q.medidaCasera(falta).texto}) y espera 30 minutos antes de usarla.`;
    } else if (nivel === 'ok') {
      estado.classList.add('estado--ok');
      estado.textContent = 'Está bien';
      consejo.textContent = `Espera al menos 30 minutos antes de usarla.${c > N.maxSabor ? ' Puede saber un poco a cloro, pero está dentro del límite.' : ''}`;
    } else {
      const agua = Q.aguaParaDiluir(V, c, objetivo);
      estado.classList.add(nivel === 'alto' ? 'estado--warn' : 'estado--bad');
      estado.textContent = nivel === 'alto' ? 'Está alta, pero dentro del límite' : 'Te pasaste';
      consejo.innerHTML = nivel === 'alto'
        ? `Se puede usar, aunque va a saber fuerte. Para bajarla a ${formatoConc(objetivo)} mg/L añade <b>${textoAgua(agua)}</b> de agua sin clorar.`
        : `Supera el valor guía de la OMS (5 mg/L), así que no la tomes. Para bajarla a ${formatoConc(objetivo)} mg/L habría que añadir <b>${textoAgua(agua)}</b> de agua sin cloro. Si no cabe, úsala para limpiar y prepara agua nueva.`;
    }
  }

  /* ---------- Vista "La química": gráfica de especiación ---------- */
  function dibujarGrafica() {
    const pH = leerNumero('qPH');
    const temp = leerNumero('qTemp');
    const pKa = Q.pKaHOCl(temp);
    const f = Q.fraccionHOCl(pH, temp);

    $('#qPHSalida').textContent = num(pH, 1);
    $('#qTempSalida').textContent = `${temp} °C`;
    $('#qPKa').textContent = num(pKa, 2);
    $('#qHOCl').textContent = `${num(f * 100, f > 0.995 || f < 0.005 ? 1 : 0)} %`;
    $('#qOCl').textContent = `${num((1 - f) * 100, f > 0.995 || f < 0.005 ? 1 : 0)} %`;

    const W = 640, H = 320, m = { l: 56, r: 18, t: 18, b: 46 };
    const x = (p) => m.l + ((p - 4) / 7) * (W - m.l - m.r);
    const y = (fr) => m.t + (1 - fr) * (H - m.t - m.b);

    let curvaH = '', curvaO = '';
    for (let p = 4; p <= 11.0001; p += 0.05) {
      const fr = Q.fraccionHOCl(p, temp);
      curvaH += `${curvaH ? 'L' : 'M'}${x(p).toFixed(1)},${y(fr).toFixed(1)}`;
      curvaO += `${curvaO ? 'L' : 'M'}${x(p).toFixed(1)},${y(1 - fr).toFixed(1)}`;
    }

    let g = '';
    // Zona pH < 8 (OMS: 30 min bastan)
    g += `<rect class="g-zona" x="${x(4)}" y="${m.t}" width="${x(8) - x(4)}" height="${H - m.t - m.b}" opacity="0.55"/>`;
    g += `<text class="g-zona-texto" x="${x(4) + 8}" y="${y(0.5) + 4}">pH &lt; 8: con 30 min basta (OMS)</text>`;
    // Rejilla y ejes
    for (let i = 0; i <= 4; i++) {
      const fr = i / 4;
      g += `<line class="g-rejilla" x1="${m.l}" x2="${W - m.r}" y1="${y(fr)}" y2="${y(fr)}"/>`;
      g += `<text class="g-eje" x="${m.l - 8}" y="${y(fr) + 4}" text-anchor="end">${fr * 100}%</text>`;
    }
    for (let p = 4; p <= 11; p++) {
      g += `<text class="g-eje" x="${x(p)}" y="${H - m.b + 18}" text-anchor="middle">${p}</text>`;
    }
    g += `<text class="g-titulo-eje" x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">pH del agua</text>`;
    g += `<text class="g-titulo-eje g-titulo-eje--y" transform="translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">% del cloro libre</text>`;
    // pKa
    g += `<line class="g-rejilla" x1="${x(pKa)}" x2="${x(pKa)}" y1="${m.t}" y2="${H - m.b}" stroke-dasharray="2 3"/>`;
    g += `<text class="g-pka" x="${x(pKa) + 5}" y="${m.t + 12}">pKa ${num(pKa, 2)}</text>`;
    // Curvas
    g += `<path class="g-hocl" d="${curvaH}"/>`;
    g += `<path class="g-ocl" d="${curvaO}"/>`;
    g += `<text class="g-leyenda-hocl" x="${x(4.25)}" y="${y(0.9)}">HOCl</text>`;
    g += `<text class="g-leyenda-ocl" x="${x(10.75)}" y="${y(0.9)}" text-anchor="end">OCl⁻</text>`;
    // pH actual
    g += `<line class="g-marca" x1="${x(pH)}" x2="${x(pH)}" y1="${m.t}" y2="${H - m.b}"/>`;
    g += `<circle class="g-punto-hocl" cx="${x(pH)}" cy="${y(f)}" r="6"/>`;
    g += `<circle class="g-punto-ocl" cx="${x(pH)}" cy="${y(1 - f)}" r="6"/>`;

    const svg = $('#grafica');
    svg.innerHTML = g;
    svg.setAttribute('aria-label', `A pH ${num(pH, 1)} y ${temp} °C: ${num(f * 100, 0)} % HOCl y ${num((1 - f) * 100, 0)} % OCl−`);
  }

  /* ---------- Vista "Decaimiento" (cinética de primer orden) ---------- */
  const CLAVE_DATOS = 'cloroseguro.decaimiento.v1';
  const EJEMPLO = {
    temp: 28,
    ejemplo: true,
    filas: [{ t: 0.5, c: 1.75 }, { t: 2, c: 1.62 }, { t: 4, c: 1.46 }, { t: 8, c: 1.22 }, { t: 12, c: 1.03 }, { t: 24, c: 0.61 }],
  };
  const copiaEjemplo = () => JSON.parse(JSON.stringify(EJEMPLO));
  let dEstado = cargarDatos();
  let ultimoAjuste = null;
  let ultimaTablaTSV = '';

  function cargarDatos() {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_DATOS));
      if (g && Array.isArray(g.filas)) return g;
    } catch (e) { /* sin almacenamiento: se usa el ejemplo */ }
    return copiaEjemplo();
  }
  function guardarDatos() {
    try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(dEstado)); } catch (e) { /* sin almacenamiento */ }
  }
  const valorCelda = (v) => (Number.isFinite(v) ? v : '');

  function pintarFilas() {
    $('#dTemp').value = valorCelda(dEstado.temp);
    $('#dFilas').innerHTML = dEstado.filas.map((f, i) => `<tr>
      <td><input type="number" inputmode="decimal" min="0" step="any" data-i="${i}" data-campo="t" value="${valorCelda(f.t)}" aria-label="Horas, medición ${i + 1}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="any" data-i="${i}" data-campo="c" value="${valorCelda(f.c)}" aria-label="Cloro libre en mg/L, medición ${i + 1}"></td>
      <td><button type="button" class="boton--quitar" data-quitar="${i}" aria-label="Quitar medición ${i + 1}">×</button></td>
    </tr>`).join('');
  }

  function formatoHoras(h) {
    if (!Number.isFinite(h)) return '—';
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h < 24) return `${num(h, 1)} h`;
    return `${num(h)} h`;
  }
  const textoDias = (h) => (Number.isFinite(h) && h >= 24 ? ` (unos ${num(h / 24, 1)} días)` : '');

  // Redondea hacia arriba a 1, 2, 2.5, 5 o 10 × potencia de 10 (para los ejes)
  function redondoBonito(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return s * p;
  }

  function actualizarDecaimiento() {
    $('#dPildora').hidden = !dEstado.ejemplo;
    const puntos = dEstado.filas
      .filter((f) => Number.isFinite(f.t) && Number.isFinite(f.c))
      .map((f) => ({ t: f.t, c: f.c }))
      .sort((a, b) => a.t - b.t);
    const aj = Q.ajustarDecaimiento(puntos);
    ultimoAjuste = aj;
    const mensaje = $('#dMensaje');

    if (!aj) {
      ['#dK', '#dVida', '#dR2', '#dRecloro'].forEach((s) => { $(s).textContent = '—'; });
      mensaje.textContent = 'Escribe al menos dos mediciones a horas distintas, con cloro mayor que 0.';
      $('#dErrores').innerHTML = '';
      $('#dGrafica').innerHTML = '';
      ultimaTablaTSV = '';
      actualizarArrhenius();
      return;
    }

    const vida = Q.vidaMedia(aj.k);
    const recloro = Q.tiempoHasta(aj.c0, aj.k, N.residualMin);
    $('#dK').textContent = `${num(aj.k, 4)} h⁻¹`;
    $('#dVida').textContent = aj.k > 0 ? formatoHoras(vida) : '—';
    $('#dR2').textContent = num(aj.r2, 3);
    $('#dRecloro').textContent = aj.k > 0 ? formatoHoras(recloro) : '—';

    if (!(aj.k > 0)) {
      mensaje.textContent = 'Con estos datos el cloro no baja con el tiempo. Revisa las mediciones: quizá se echó más cloro o hay un error al anotar.';
    } else if (aj.c0 <= N.residualMin) {
      mensaje.textContent = 'El cloro ya empieza por debajo de 0.2 mg/L: hay que volver a clorar ahora.';
    } else {
      let t = `El cloro baja a la mitad cada ${formatoHoras(vida)} y llega a 0.2 mg/L unas ${formatoHoras(recloro)}${textoDias(recloro)} después de clorar.`;
      if (aj.r2 < 0.9) t += ' Ojo: el ajuste es débil (R² < 0.9). Puede haber errores de medición o el cloro no sigue un decaimiento de primer orden.';
      mensaje.textContent = t;
    }

    // Tabla de error: lo medido contra lo que predice el modelo
    let sumaError = 0;
    const filas = puntos.map((p) => {
      const calc = Q.concentracionEnTiempo(aj.c0, aj.k, p.t);
      const error = (Math.abs(p.c - calc) / p.c) * 100;
      sumaError += error;
      return { ...p, calc, error };
    });
    const errorMedio = sumaError / filas.length;
    $('#dErrores').innerHTML = filas.map((f) =>
      `<tr><td>${num(f.t, 1)} h</td><td>${num(f.c, 2)}</td><td>${num(f.calc, 2)}</td><td>${num(f.error, 1)} %</td></tr>`).join('') +
      `<tr><td colspan="3"><b>Error promedio</b></td><td><b>${num(errorMedio, 1)} %</b></td></tr>`;
    ultimaTablaTSV = ['Hora (h)\tCloro medido (mg/L)\tCloro calculado (mg/L)\tError (%)']
      .concat(filas.map((f) => [f.t, f.c.toFixed(2), f.calc.toFixed(2), f.error.toFixed(1)].join('\t')))
      .concat([`Error promedio\t\t\t${errorMedio.toFixed(1)}`, '', `k (h-1)\t${aj.k.toFixed(4)}`, `C0 (mg/L)\t${aj.c0.toFixed(2)}`, `R2\t${aj.r2.toFixed(3)}`, `Temperatura (°C)\t${dEstado.temp}`])
      .join('\n');

    dibujarDecaimiento(puntos, aj, recloro);
    actualizarArrhenius();
  }

  function dibujarDecaimiento(puntos, aj, recloro) {
    const W = 640, H = 300, m = { l: 52, r: 18, t: 18, b: 46 };
    const tMax = Math.max(...puntos.map((p) => p.t));
    let xFin = tMax;
    if (aj.k > 0 && Number.isFinite(recloro) && recloro > tMax && recloro < tMax * 4) xFin = recloro;
    const pasoX = redondoBonito((xFin * 1.08) / 6);
    const xMax = Math.ceil((xFin * 1.08) / pasoX) * pasoX;
    const cTop = Math.max(...puntos.map((p) => p.c), aj.c0);
    const pasoY = redondoBonito((cTop * 1.15) / 5);
    const yMax = Math.ceil((cTop * 1.15) / pasoY) * pasoY;
    const x = (t) => m.l + (t / xMax) * (W - m.l - m.r);
    const y = (c) => H - m.b - (c / yMax) * (H - m.t - m.b);

    let g = '';
    for (let c = 0; c <= yMax + 1e-9; c += pasoY) {
      g += `<line class="g-rejilla" x1="${m.l}" x2="${W - m.r}" y1="${y(c)}" y2="${y(c)}"/>`;
      g += `<text class="g-eje" x="${m.l - 8}" y="${y(c) + 4}" text-anchor="end">${num(c, pasoY < 1 ? 1 : 0)}</text>`;
    }
    for (let t = 0; t <= xMax + 1e-9; t += pasoX) {
      g += `<text class="g-eje" x="${x(t)}" y="${H - m.b + 18}" text-anchor="middle">${num(t, pasoX < 1 ? 1 : 0)}</text>`;
    }
    g += `<text class="g-titulo-eje" x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">Horas después de clorar</text>`;
    g += `<text class="g-titulo-eje g-titulo-eje--y" transform="translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">Cloro libre (mg/L)</text>`;

    // Límite de 0.2 mg/L
    if (N.residualMin <= yMax) {
      g += `<line class="d-limite" x1="${m.l}" x2="${W - m.r}" y1="${y(N.residualMin)}" y2="${y(N.residualMin)}"/>`;
      g += `<text class="d-limite-texto" x="${m.l + 6}" y="${y(N.residualMin) - 6}">0.2 mg/L: mínimo</text>`;
    }
    // Curva del modelo
    let d = '';
    for (let i = 0; i <= 80; i++) {
      const t = (xMax * i) / 80;
      const c = Q.concentracionEnTiempo(aj.c0, aj.k, t);
      if (c > yMax) continue;
      d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y(c).toFixed(1)}`;
    }
    g += `<path class="d-curva" d="${d}"/>`;
    // Momento de volver a clorar
    if (aj.k > 0 && Number.isFinite(recloro) && recloro <= xMax && recloro > 0) {
      g += `<line class="d-recloro" x1="${x(recloro)}" x2="${x(recloro)}" y1="${m.t}" y2="${H - m.b}"/>`;
      const alFinal = x(recloro) > W - 170;
      g += `<text class="d-recloro-texto" x="${x(recloro) + (alFinal ? -6 : 6)}" y="${m.t + 12}" text-anchor="${alFinal ? 'end' : 'start'}">Volver a clorar: ${formatoHoras(recloro)}</text>`;
    }
    // Mediciones
    g += puntos.map((p) => `<circle class="d-punto" cx="${x(p.t)}" cy="${y(p.c)}" r="6"><title>${num(p.t, 1)} h: ${num(p.c, 2)} mg/L medidos</title></circle>`).join('');
    $('#dGrafica').innerHTML = g;
  }

  function copiarTexto(texto, aviso) {
    const listo = () => { aviso.textContent = 'Copiada. Pégala en Word o Excel.'; };
    const respaldo = () => {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      aviso.textContent = ok ? 'Copiada. Pégala en Word o Excel.' : 'No se pudo copiar. Selecciona la tabla y cópiala a mano.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo, respaldo);
    } else {
      respaldo();
    }
  }

  /* ---------- Arrhenius ---------- */
  function actualizarArrhenius() {
    const T1 = leerNumero('aT1'), k1 = leerNumero('aK1');
    const T2 = leerNumero('aT2'), k2 = leerNumero('aK2');
    const T3 = leerNumero('aT3');
    const pred = $('#aPrediccion');
    const lista = $('#aCalculos');
    if (![T1, k1, T2, k2, T3].every(Number.isFinite) || !(k1 > 0) || !(k2 > 0) || T1 === T2) {
      $('#aEa').textContent = '—';
      pred.textContent = 'Escribe dos experimentos a temperaturas distintas, con k mayor que 0.';
      lista.innerHTML = '';
      return;
    }
    const ea = Q.energiaActivacion(k1, T1, k2, T2);
    const k3 = Q.kATemperatura(k1, T1, ea, T3);
    $('#aEa').textContent = num(ea / 1000, 1);
    let t = `A ${numAuto(T3)} °C: k = ${num(k3, 4)} h⁻¹ y el cloro baja a la mitad en ${formatoHoras(Q.vidaMedia(k3))}`;
    if (ultimoAjuste && ultimoAjuste.c0 > N.residualMin && k3 > 0) {
      t += `. Empezando en ${num(ultimoAjuste.c0, 2)} mg/L, llega a 0.2 mg/L en ${formatoHoras(Q.tiempoHasta(ultimoAjuste.c0, k3, N.residualMin))}`;
    }
    t += '.';
    if (ea <= 0) t += ' Ojo: Ea salió negativa, es decir, el cloro se gastó más rápido en el agua fría. Revisa las mediciones.';
    pred.textContent = t;
    const T1K = T1 + 273.15, T2K = T2 + 273.15, T3K = T3 + 273.15;
    lista.innerHTML = [
      `<b>Energía de activación</b><span class="formula">Ea = R · ln(k₂/k₁) / (1/T₁ − 1/T₂)\n   = 8.314 × ln(${num(k2, 4)} / ${num(k1, 4)}) / (1/${num(T1K, 2)} − 1/${num(T2K, 2)})\n   = ${num(ea)} J/mol = ${num(ea / 1000, 1)} kJ/mol</span>`,
      `<b>k a ${numAuto(T3)} °C</b><span class="formula">k₃ = k₁ · e^(−Ea/R · (1/T₃ − 1/T₁))\n   = ${num(k1, 4)} · e^(−${num(ea / 8.314, 0)} × (1/${num(T3K, 2)} − 1/${num(T1K, 2)}))\n   = ${num(k3, 4)} h⁻¹</span>`,
    ].map((i) => `<li>${i}</li>`).join('');
  }

  /* ---------- Vista "Corrosión" (índice de Langelier) ---------- */
  const conSigno = (v, dec = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), dec);

  function actualizarCorrosion() {
    const desconocido = $('#cTDSDesconocido').checked;
    $('#cTDS').disabled = desconocido;
    const datos = {
      pH: leerNumero('cPH'),
      tempC: leerNumero('cTemp'),
      durezaCalcica: leerNumero('cCalcio'),
      alcalinidad: leerNumero('cAlc'),
      tds: desconocido ? 300 : leerNumero('cTDS'),
    };
    const estado = $('#cEstado');
    estado.className = 'estado';
    const valido = datos.pH >= 0 && datos.pH <= 14 && datos.tempC > -5 && datos.tempC < 100 &&
      datos.durezaCalcica > 0 && datos.alcalinidad > 0 && datos.tds > 0;
    if (!valido) {
      $('#cLSI').textContent = '—';
      $('#cAguja').style.left = '50%';
      estado.textContent = 'Revisa los datos';
      $('#cConsejo').textContent = 'El pH va de 0 a 14, y la dureza, la alcalinidad y los SDT deben ser mayores que 0.';
      ['#cPHs', '#cPHTu', '#cHOCl'].forEach((s) => { $(s).textContent = '—'; });
      $('#cBalance').textContent = '';
      $('#cCalculos').innerHTML = '';
      return;
    }

    const r = Q.langelier(datos);
    const cl = Q.clasificarLangelier(r.lsi);
    $('#cLSI').textContent = conSigno(r.lsi);
    $('#cAguja').style.left = `${((Math.max(-4, Math.min(4, r.lsi)) + 4) / 8) * 100}%`;
    estado.classList.add({ corrosion: 'estado--bad', equilibrio: 'estado--ok', sarro: 'estado--warn' }[cl.tipo]);
    estado.textContent = cl.nombre;
    $('#cConsejo').textContent = {
      corrosion: 'El agua tiende a disolver carbonato y a atacar el metal: tuberías de hierro o cobre, llaves y el calentador. Puede soltar hierro (agua rojiza) o cobre (sabor metálico). Al tinaco plástico no lo daña.',
      equilibrio: 'El agua está cerca del equilibrio con el carbonato de calcio: no corroe ni deja sarro de forma importante.',
      sarro: 'El agua tiende a soltar carbonato de calcio: sarro blanco en el tinaco, las duchas y el calentador. El sarro tapa tuberías y hace que el calentador gaste más energía.',
    }[cl.tipo];

    const f = Q.fraccionHOCl(datos.pH, datos.tempC);
    const fS = Q.fraccionHOCl(r.pHs, datos.tempC);
    $('#cPHs').textContent = num(r.pHs, 2);
    $('#cPHTu').textContent = num(datos.pH, 1);
    $('#cHOCl').textContent = `${Math.round(f * 100)} %`;
    const pct = (v) => `${Math.round(v * 100)} %`;
    let balance;
    if (cl.tipo === 'corrosion') {
      balance = `Para que el agua deje de corroer habría que subir el pH hasta cerca de ${num(r.pHs, 1)}. Pero a ese pH solo el ${pct(fS)} del cloro sería HOCl (ahora es el ${pct(f)}): protegería las tuberías y desinfectaría peor. Si se sube el pH, hay que dejar más tiempo de contacto con el cloro.`;
    } else if (cl.tipo === 'sarro') {
      balance = `Aquí la química ayuda por los dos lados: bajar el pH hacia ${num(r.pHs, 1)} reduce el sarro y además deja más cloro como HOCl (el ${pct(fS)}, contra el ${pct(f)} de ahora).`;
    } else {
      const f85 = Q.fraccionHOCl(8.5, datos.tempC);
      balance = `Tu agua está cerca del equilibrio con pH ${num(datos.pH, 1)} y el ${pct(f)} del cloro como HOCl. Subir el pH la haría aún menos corrosiva, pero a pH 8.5 solo el ${pct(f85)} del cloro desinfecta.`;
    }
    $('#cBalance').textContent = balance;

    $('#cCalculos').innerHTML = [
      `<b>Sólidos disueltos (A)</b><span class="formula">A = (log₁₀ ${numAuto(datos.tds)} − 1) / 10 = ${num(r.A, 4)}</span>`,
      `<b>Temperatura (B)</b><span class="formula">B = −13.12 · log₁₀(${numAuto(datos.tempC)} + 273) + 34.55 = ${num(r.B, 4)}</span>`,
      `<b>Calcio (C)</b><span class="formula">C = log₁₀ ${numAuto(datos.durezaCalcica)} − 0.4 = ${num(r.C, 4)}</span>`,
      `<b>Alcalinidad (D)</b><span class="formula">D = log₁₀ ${numAuto(datos.alcalinidad)} = ${num(r.D, 4)}</span>`,
      `<b>pH de saturación</b><span class="formula">pHs = (9.3 + A + B) − (C + D)\n    = (9.3 + ${num(r.A, 4)} + ${num(r.B, 4)}) − (${num(r.C, 4)} + ${num(r.D, 4)})\n    = ${num(r.pHs, 3)}</span>`,
      `<b>Índice de Langelier</b><span class="formula">LSI = pH − pHs = ${num(datos.pH, 2)} − ${num(r.pHs, 3)} = ${conSigno(r.lsi, 3)}</span>`,
    ].map((i) => `<li>${i}</li>`).join('');
  }

  /* ---------- Pestañas ---------- */
  const VISTAS = ['calcular', 'verificar', 'decaimiento', 'corrosion', 'quimica'];

  function mostrarVista(nombre) {
    if (!VISTAS.includes(nombre)) nombre = 'calcular';
    vistaActual = nombre;
    $$('.pestana').forEach((b) => {
      const activa = b.dataset.vista === nombre;
      b.setAttribute('aria-selected', String(activa));
      b.tabIndex = activa ? 0 : -1;
    });
    VISTAS.forEach((v) => { $('#vista-' + v).hidden = v !== nombre; });
    if (nombre === 'quimica') dibujarGrafica();
    if (nombre === 'verificar') actualizarVerificacion();
    if (nombre === 'decaimiento') actualizarDecaimiento();
    if (nombre === 'corrosion') actualizarCorrosion();
    actualizarBarra();
  }

  $$('.pestana').forEach((b, i, todas) => {
    b.addEventListener('click', () => {
      try { history.replaceState(null, '', '#' + b.dataset.vista); } catch (e) { /* sin historial */ }
      mostrarVista(b.dataset.vista);
      window.scrollTo(0, 0);
    });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const j = (i + (e.key === 'ArrowRight' ? 1 : todas.length - 1)) % todas.length;
      todas[j].focus();
      todas[j].click();
    });
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (VISTAS.includes(h)) mostrarVista(h);
  });

  /* ---------- Eventos ---------- */
  $('#formCalcular').addEventListener('input', actualizarCalculo);
  $('#formCalcular').addEventListener('change', (e) => {
    actualizarCalculo();
    if (e.target.name === 'pctLiq' && e.target.value === 'otro') $('#pctLiqOtro').focus();
    if (e.target.name === 'pctGran' && e.target.value === 'otro') $('#pctGranOtro').focus();
  });
  $('#formCalcular').addEventListener('submit', (e) => e.preventDefault());
  $('#formVerificar').addEventListener('input', actualizarVerificacion);
  $('#formVerificar').addEventListener('change', actualizarVerificacion);
  $('#formVerificar').addEventListener('submit', (e) => e.preventDefault());
  $('#qPH').addEventListener('input', dibujarGrafica);
  $('#qTemp').addEventListener('input', dibujarGrafica);

  // Decaimiento
  $('#dFilas').addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.campo) return;
    const fila = dEstado.filas[Number(el.dataset.i)];
    if (!fila) return;
    const v = parseFloat(el.value);
    fila[el.dataset.campo] = Number.isFinite(v) ? v : null;
    dEstado.ejemplo = false;
    guardarDatos();
    actualizarDecaimiento();
  });
  $('#dFilas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar]');
    if (!b) return;
    dEstado.filas.splice(Number(b.dataset.quitar), 1);
    dEstado.ejemplo = false;
    guardarDatos();
    pintarFilas();
    actualizarDecaimiento();
  });
  $('#dTemp').addEventListener('input', () => {
    const v = parseFloat($('#dTemp').value);
    dEstado.temp = Number.isFinite(v) ? v : null;
    guardarDatos();
  });
  $('#dAgregar').addEventListener('click', () => {
    const ultima = dEstado.filas.at(-1);
    dEstado.filas.push({ t: null, c: null });
    if (ultima && dEstado.ejemplo) dEstado.ejemplo = false;
    guardarDatos();
    pintarFilas();
    actualizarDecaimiento();
    const inputs = $$('#dFilas input[data-campo="t"]');
    if (inputs.length) inputs.at(-1).focus();
  });
  $('#dEjemplo').addEventListener('click', () => {
    dEstado = copiaEjemplo();
    guardarDatos();
    pintarFilas();
    actualizarDecaimiento();
  });
  $('#dBorrar').addEventListener('click', () => {
    dEstado = { temp: dEstado.temp, ejemplo: false, filas: [{ t: null, c: null }, { t: null, c: null }] };
    guardarDatos();
    pintarFilas();
    actualizarDecaimiento();
  });
  $('#dCopiar').addEventListener('click', () => {
    const aviso = $('#dCopiado');
    if (!ultimaTablaTSV) { aviso.textContent = 'Primero escribe tus mediciones.'; return; }
    copiarTexto(ultimaTablaTSV, aviso);
  });

  // Arrhenius
  ['aT1', 'aK1', 'aT2', 'aK2', 'aT3'].forEach((id) => $('#' + id).addEventListener('input', actualizarArrhenius));
  ['aT2', 'aK2'].forEach((id) => $('#' + id).addEventListener('input', () => { $('#aPildora').hidden = true; }));
  $('#aUsarK').addEventListener('click', () => {
    if (!ultimoAjuste || !(ultimoAjuste.k > 0)) return;
    $('#aK1').value = ultimoAjuste.k.toFixed(4);
    if (Number.isFinite(dEstado.temp)) $('#aT1').value = dEstado.temp;
    actualizarArrhenius();
  });

  // Corrosión
  $('#formCorrosion').addEventListener('input', actualizarCorrosion);
  $('#formCorrosion').addEventListener('change', actualizarCorrosion);
  $('#formCorrosion').addEventListener('submit', (e) => e.preventDefault());

  /* ---------- Arranque ---------- */
  pintarFilas();
  actualizarCalculo();
  actualizarVerificacion();
  actualizarDecaimiento();
  actualizarCorrosion();
  dibujarGrafica();
  mostrarVista(location.hash.slice(1));

  /* ---------- Funciona sin internet (service worker) ---------- */
  const enLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !enLocal) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
    });
  }
})();
