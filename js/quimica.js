/*
 * CloroSeguro: módulo de química
 * ------------------------------
 * Aquí viven TODOS los cálculos químicos de la aplicación, como funciones
 * puras (reciben números y devuelven números, sin tocar la pantalla).
 * Así se pueden probar por separado (ver pruebas/quimica.test.js) y la
 * interfaz (app.js) solo se encarga de mostrar los resultados.
 *
 * Principios químicos usados:
 *   1. Concentración y dilución: C1·V1 = C2·V2
 *   2. Estequiometría: equivalencia NaOCl ≡ Cl2 ("cloro disponible")
 *   3. Equilibrio ácido-base: HOCl ⇌ H+ + OCl−  (pKa ≈ 7.5)
 *   4. Efecto de la temperatura en el pKa (ecuación de Morris, 1966)
 *   5. Concepto C·t (concentración × tiempo) para la desinfección
 *   6. Cinética de primer orden del cloro y ecuación de Arrhenius
 *   7. Equilibrio de solubilidad del CaCO3: índice de Langelier
 */
(function (raiz) {
  'use strict';

  // Masas molares en g/mol
  const MASA_MOLAR = {
    Cl2: 70.906,
    NaOCl: 74.442,
    CaOCl2: 142.98, // Ca(OCl)2
    HOCl: 52.46,
  };

  // 1 mol de NaOCl oxida lo mismo que 1 mol de Cl2 (los dos aceptan 2 electrones):
  //   HOCl + H+ + 2e− → Cl− + H2O      Cl2 + 2e− → 2Cl−
  // Por eso el "cloro disponible" se expresa como masa equivalente de Cl2.
  const FACTOR_NaOCl_A_Cl2 = MASA_MOLAR.Cl2 / MASA_MOLAR.NaOCl; // ≈ 0.9525

  const UNIDADES = {
    L_POR_GALON: 3.785411784,
    ML_POR_GOTA: 0.05, // gota estándar de farmacia (20 gotas = 1 mL)
    ML_CUCHARADITA: 5,
    ML_CUCHARADA: 15,
    ML_TAZA: 240,
  };

  // Valores de referencia y de dónde salen (ver el reporte para las citas completas)
  const NORMAS = {
    dosisClara: 2.0, // mg/L, agua clara (CDC Safe Water System; Wilhelm et al., 2018)
    dosisTurbia: 4.0, // mg/L, agua ligeramente turbia (ídem)
    choque: {
      normal: { mgL: 50, horas: 24 }, // desinfección de tanques (OMS, Nota Técnica 3)
      urgente: { mgL: 100, horas: 8 }, // doble de cloro, menos tiempo (ídem)
    },
    residualMin: 0.2, // mg/L en el punto de consumo (OMS, Nota Técnica 11)
    residualOMS: 0.5, // mg/L tras 30 min a pH < 8 (OMS, Guías de calidad del agua)
    maxSabor: 2.0, // mg/L, límite de aceptabilidad del sabor (CDC)
    maxOMS: 5.0, // mg/L, valor guía de la OMS para cloro
    minimoDesinfeccion: 1.5, // mg/L, por debajo de esto la dosis inicial se considera corta
    tiempoMin: 30, // minutos de contacto mínimo (OMS)
    pHRef: 8.0, // la OMS pide pH < 8 para los 30 min
    tempMinima: 18, // °C; con agua más fría hay que esperar más (OMS, NT 11)
    gotasPorGalonMSP: 5, // Ministerio de Salud Pública RD: 5 gotas de cloro al 5 % por galón
    pctMSP: 5,
  };

  /* ---------- Volumen ---------- */

  function aLitros(valor, unidad) {
    switch (unidad) {
      case 'L': return valor;
      case 'gal': return valor * UNIDADES.L_POR_GALON;
      case 'm3': return valor * 1000;
      default: throw new Error('Unidad de volumen desconocida: ' + unidad);
    }
  }

  function aMetros(valor, unidad) {
    const f = { m: 1, cm: 0.01, ft: 0.3048, in: 0.0254 }[unidad];
    if (f === undefined) throw new Error('Unidad de longitud desconocida: ' + unidad);
    return valor * f;
  }

  // Tinaco o tanque redondo: V = π·r²·h  (1 m³ = 1000 L)
  function volumenCilindro(diametroM, alturaAguaM) {
    return Math.PI * Math.pow(diametroM / 2, 2) * alturaAguaM * 1000;
  }

  // Cisterna o tanque cuadrado: V = largo·ancho·h
  function volumenRectangular(largoM, anchoM, alturaAguaM) {
    return largoM * anchoM * alturaAguaM * 1000;
  }

  /* ---------- El producto (la fuente de cloro) ---------- */

  // El cloro comercial trae NaOCl y también NaCl (los dos salen de la misma reacción:
  // Cl2 + 2NaOH → NaOCl + NaCl + H2O), por eso pesa más que el agua.
  // Aproximación lineal de la densidad: ρ ≈ 1 + 0.015·(% NaOCl)  [g/mL]
  function densidadCloroLiquido(pctNaOCl) {
    return 1 + 0.015 * pctNaOCl;
  }

  /*
   * producto = { forma: 'liquido' | 'granulado', porcentaje: número, base: 'NaOCl' | 'disponible' }
   *  - Líquido: hipoclorito de sodio (cloro de casa). La etiqueta puede dar el % de NaOCl
   *    o el % de "cloro disponible/activo".
   *  - Granulado: hipoclorito de calcio Ca(OCl)2 ("HTH"); la etiqueta da % de cloro disponible.
   */
  function analizarProducto(producto) {
    const pct = Number(producto.porcentaje);
    if (!(pct > 0) || pct > 100) throw new Error('Porcentaje inválido');

    if (producto.forma === 'granulado') {
      // % m/m → mg de cloro disponible por gramo de producto
      return {
        forma: 'granulado',
        pctDisponible: pct,
        mgClPorGramo: (pct / 100) * 1000,
        // máximo teórico para Ca(OCl)2 puro: 2 mol Cl2 por mol → 2·70.906/142.98 = 99.2 %
        pctTeoricoPuro: (2 * MASA_MOLAR.Cl2 / MASA_MOLAR.CaOCl2) * 100,
      };
    }

    const pctNaOCl = producto.base === 'disponible' ? pct / FACTOR_NaOCl_A_Cl2 : pct;
    const pctDisponible = pctNaOCl * FACTOR_NaOCl_A_Cl2;
    const densidad = densidadCloroLiquido(pctNaOCl);
    // (g cloro / 100 g solución) × (g solución / mL) × 1000 mL/L × 1000 mg/g
    const mgPorL = (pctDisponible / 100) * densidad * 1e6;
    const molaridadNaOCl = ((pctNaOCl / 100) * densidad * 1000) / MASA_MOLAR.NaOCl; // mol/L

    return { forma: 'liquido', pctNaOCl, pctDisponible, densidad, mgPorL, molaridadNaOCl };
  }

  /* ---------- Dosis ---------- */

  /*
   * ¿Cuánto producto hace falta para que volumenL litros de agua queden a cObjetivo mg/L?
   * Líquido: C1·V1 = C2·(Vagua + V1)  →  V1 = C2·Vagua / (C1 − C2)
   * Granulado: masa = C2·V / (mg de cloro por gramo)
   */
  function calcularDosis(volumenL, cObjetivo, producto) {
    const p = analizarProducto(producto);
    const mgNecesarios = cObjetivo * volumenL;
    if (p.forma === 'granulado') {
      return Object.assign({}, p, { mgNecesarios, gramos: mgNecesarios / p.mgClPorGramo });
    }
    const litros = (cObjetivo * volumenL) / (p.mgPorL - cObjetivo);
    return Object.assign({}, p, { mgNecesarios, mL: litros * 1000 });
  }

  // Lo contrario: ya se echó cierta cantidad, ¿qué concentración quedó?
  // cantidad = mL (líquido) o gramos (granulado)
  function concentracionResultante(volumenL, cantidad, producto) {
    const p = analizarProducto(producto);
    if (p.forma === 'granulado') return (cantidad * p.mgClPorGramo) / volumenL;
    const v1 = cantidad / 1000; // L
    return (p.mgPorL * v1) / (volumenL + v1);
  }

  // Si se pasó de cloro: agua sin clorar que hay que añadir para bajar a cObjetivo.
  // C1·V1 = C2·(V1 + Vañadida)  →  Vañadida = V1·(C1/C2 − 1)
  function aguaParaDiluir(volumenL, cActual, cObjetivo) {
    if (cActual <= cObjetivo) return 0;
    return volumenL * (cActual / cObjetivo - 1);
  }

  /* ---------- Equilibrio ácido-base del cloro ---------- */

  // pKa del ácido hipocloroso en función de la temperatura (Morris, 1966). T en kelvin.
  function pKaHOCl(tempC) {
    const T = tempC + 273.15;
    return 3000.0 / T - 10.0686 + 0.0253 * T;
  }

  // Henderson–Hasselbalch: fracción del cloro libre que está como HOCl (el desinfectante fuerte)
  //   α(HOCl) = 1 / (1 + 10^(pH − pKa))
  function fraccionHOCl(pH, tempC) {
    return 1 / (1 + Math.pow(10, pH - pKaHOCl(tempC)));
  }

  /*
   * Tiempo de contacto recomendado (modelo C·t simplificado).
   * La OMS pide ≥ 30 min con pH < 8. Tomamos pH 8 como el peor caso aceptado y exigimos
   * la misma "dosis de HOCl × tiempo": si a tu pH hay menos HOCl, hay que esperar más.
   *   t = 30 min × máx(1, α(pH 8) / α(pH))
   * Si el agua está fría (< 18 °C) la reacción es más lenta → se duplica el tiempo.
   */
  function tiempoContacto(pH, tempC) {
    const fraccion = fraccionHOCl(pH, tempC);
    const fraccionRef = fraccionHOCl(NORMAS.pHRef, tempC);
    let minutos = NORMAS.tiempoMin * Math.max(1, fraccionRef / fraccion);
    const aguaFria = tempC < NORMAS.tempMinima;
    if (aguaFria) minutos *= 2;
    return { minutos, fraccion, fraccionRef, aguaFria, pKa: pKaHOCl(tempC) };
  }

  /* ---------- Regla de Salud Pública: 5 gotas por galón ---------- */

  // ¿Qué concentración da la regla de las 5 gotas por galón con TU cloro?
  function concentracionReglaMSP(producto) {
    const p = analizarProducto(producto);
    if (p.forma !== 'liquido') return null;
    const mL = NORMAS.gotasPorGalonMSP * UNIDADES.ML_POR_GOTA;
    return concentracionResultante(UNIDADES.L_POR_GALON, mL, producto);
  }

  /* ---------- Evaluación ---------- */

  function evaluarConcentracion(c) {
    if (c < NORMAS.minimoDesinfeccion) return 'bajo';
    if (c <= NORMAS.maxOMS - 0.5) return 'ok';
    if (c <= NORMAS.maxOMS) return 'alto';
    return 'excesivo';
  }

  /* ---------- Medidas caseras ---------- */

  // Redondea a cuartos y lo escribe bonito: 2.5 → "2 ½"
  function textoCuartos(x) {
    let entero = Math.floor(x + 1e-9);
    let cuartos = Math.round((x - entero) * 4);
    if (cuartos === 4) { entero += 1; cuartos = 0; }
    const simbolo = ['', '¼', '½', '¾'][cuartos];
    if (entero === 0) return simbolo || '0';
    return simbolo ? entero + ' ' + simbolo : String(entero);
  }

  function aCuartos(x) { return Math.round(x * 4) / 4; }

  function medidaCasera(mL) {
    const u = UNIDADES;
    if (mL < 2.5) {
      const g = Math.max(1, Math.round(mL / u.ML_POR_GOTA));
      return { valor: g, texto: g + (g === 1 ? ' gota' : ' gotas') };
    }
    const tabla = [
      [15, u.ML_CUCHARADITA, 'cucharadita', 'cucharaditas'],
      [240, u.ML_CUCHARADA, 'cucharada', 'cucharadas'],
      [1000, u.ML_TAZA, 'taza', 'tazas'],
      [Infinity, 1000, 'litro', 'litros'],
    ];
    for (const [limite, tam, sing, plur] of tabla) {
      if (mL < limite) {
        const x = aCuartos(mL / tam);
        return { valor: x, texto: textoCuartos(x) + ' ' + (x > 1 ? plur : sing) };
      }
    }
  }

  /* ---------- Cinética: el cloro se gasta con el tiempo ---------- */

  const R_GASES = 8.314; // J/(mol·K)

  /*
   * Decaimiento de primer orden: C(t) = C0·e^(−k·t)
   * Tomando logaritmo: ln C = ln C0 − k·t, que es una RECTA.
   * Con las mediciones (t en horas, c en mg/L) se ajusta esa recta por mínimos cuadrados:
   * la pendiente es −k y el corte es ln C0. R² dice qué tan bien se ajusta el modelo.
   */
  function ajustarDecaimiento(puntos) {
    const validos = puntos.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.t >= 0 && p.c > 0);
    if (validos.length < 2) return null;
    const n = validos.length;
    const xs = validos.map((p) => p.t);
    const ys = validos.map((p) => Math.log(p.c));
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx === 0) return null; // todas las mediciones a la misma hora
    const pendiente = sxy / sxx;
    return {
      k: -pendiente, // h⁻¹
      c0: Math.exp(my - pendiente * mx), // mg/L
      r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
      n,
    };
  }

  function concentracionEnTiempo(c0, k, t) {
    return c0 * Math.exp(-k * t);
  }

  // Vida media: el tiempo en que el cloro baja a la mitad. t½ = ln 2 / k
  function vidaMedia(k) {
    return k > 0 ? Math.LN2 / k : Infinity;
  }

  // ¿Cuántas horas hasta que el cloro baje a cLimite? t = ln(C0 / C) / k
  function tiempoHasta(c0, k, cLimite) {
    if (c0 <= cLimite) return 0;
    if (!(k > 0)) return Infinity;
    return Math.log(c0 / cLimite) / k;
  }

  /*
   * Arrhenius: k = A·e^(−Ea/RT). Con dos experimentos a temperaturas distintas:
   *   ln(k2/k1) = (Ea/R)·(1/T1 − 1/T2)  →  Ea = R·ln(k2/k1) / (1/T1 − 1/T2)
   */
  function energiaActivacion(k1, t1C, k2, t2C) {
    const T1 = t1C + 273.15, T2 = t2C + 273.15;
    return (R_GASES * Math.log(k2 / k1)) / (1 / T1 - 1 / T2); // J/mol
  }

  // Con Ea conocida, k a otra temperatura: k2 = k1·e^(−Ea/R·(1/T2 − 1/T1))
  function kATemperatura(k1, t1C, ea, t2C) {
    const T1 = t1C + 273.15, T2 = t2C + 273.15;
    return k1 * Math.exp((-ea / R_GASES) * (1 / T2 - 1 / T1));
  }

  /* ---------- Solubilidad: índice de saturación de Langelier ---------- */

  /*
   * CaCO3(s) ⇌ Ca²⁺ + CO3²⁻   y   HCO3⁻ ⇌ H⁺ + CO3²⁻
   * pHs es el pH al que el agua estaría justo saturada de CaCO3 (Langelier, 1936).
   * Forma empírica usada en tratamiento de aguas:
   *   pHs = (9.3 + A + B) − (C + D)
   *   A = (log10 SDT − 1) / 10                 (sólidos disueltos totales, mg/L)
   *   B = −13.12·log10(°C + 273) + 34.55       (temperatura)
   *   C = log10(dureza cálcica como CaCO3) − 0.4
   *   D = log10(alcalinidad como CaCO3)
   *   LSI = pH − pHs   (negativo: corrosiva; positivo: forma sarro)
   */
  function langelier({ pH, tempC, durezaCalcica, alcalinidad, tds }) {
    const A = (Math.log10(tds) - 1) / 10;
    const B = -13.12 * Math.log10(tempC + 273) + 34.55;
    const C = Math.log10(durezaCalcica) - 0.4;
    const D = Math.log10(alcalinidad);
    const pHs = 9.3 + A + B - (C + D);
    return { A, B, C, D, pHs, lsi: pH - pHs };
  }

  // Rangos de interpretación de Saha y Hawkins (Universidad de Georgia, 2026)
  function clasificarLangelier(lsi) {
    if (lsi <= -5) return { tipo: 'corrosion', nombre: 'Corrosión muy severa' };
    if (lsi <= -3) return { tipo: 'corrosion', nombre: 'Corrosión severa' };
    if (lsi <= -2) return { tipo: 'corrosion', nombre: 'Corrosión moderada' };
    if (lsi <= -1) return { tipo: 'corrosion', nombre: 'Corrosión leve' };
    if (lsi < 1) return { tipo: 'equilibrio', nombre: 'Ni corroe ni forma sarro' };
    if (lsi < 3) return { tipo: 'sarro', nombre: 'Sarro leve' };
    if (lsi < 4) return { tipo: 'sarro', nombre: 'Sarro moderado' };
    return { tipo: 'sarro', nombre: 'Sarro severo' };
  }

  const API = {
    MASA_MOLAR, FACTOR_NaOCl_A_Cl2, UNIDADES, NORMAS, R_GASES,
    aLitros, aMetros, volumenCilindro, volumenRectangular,
    densidadCloroLiquido, analizarProducto,
    calcularDosis, concentracionResultante, aguaParaDiluir,
    pKaHOCl, fraccionHOCl, tiempoContacto,
    concentracionReglaMSP, evaluarConcentracion,
    textoCuartos, medidaCasera,
    ajustarDecaimiento, concentracionEnTiempo, vidaMedia, tiempoHasta,
    energiaActivacion, kATemperatura,
    langelier, clasificarLangelier,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.Quimica = API;
})(typeof window !== 'undefined' ? window : globalThis);
