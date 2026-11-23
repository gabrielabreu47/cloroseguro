// Pruebas del módulo de química. Correr con:  node --test pruebas/
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../app/js/quimica.js');

const cerca = (real, esperado, tol, msg) =>
  assert.ok(Math.abs(real - esperado) <= tol, `${msg}: ${real} ≠ ${esperado} ± ${tol}`);

const cloro5 = { forma: 'liquido', porcentaje: 5, base: 'NaOCl' };

test('pKa del HOCl a 25 °C ≈ 7.54 (Morris, 1966)', () => {
  cerca(Q.pKaHOCl(25), 7.537, 0.01, 'pKa 25 °C');
  // a menor temperatura el pKa sube (menos disociación)
  assert.ok(Q.pKaHOCl(10) > Q.pKaHOCl(30));
});

test('en pH = pKa hay 50 % de HOCl y 50 % de OCl−', () => {
  cerca(Q.fraccionHOCl(Q.pKaHOCl(25), 25), 0.5, 1e-9, 'fracción');
  cerca(Q.fraccionHOCl(6, 25), 0.97, 0.01, 'pH 6');
  cerca(Q.fraccionHOCl(9, 25), 0.033, 0.005, 'pH 9');
});

test('cloro al 5 % NaOCl → 4.76 % disponible y ≈ 51 200 mg/L', () => {
  const p = Q.analizarProducto(cloro5);
  cerca(p.pctDisponible, 4.763, 0.001, '% disponible');
  cerca(p.densidad, 1.075, 1e-9, 'densidad');
  cerca(p.mgPorL, 51199, 5, 'mg/L');
  cerca(p.molaridadNaOCl, 0.722, 0.001, 'molaridad');
});

test('etiqueta en "cloro disponible" se convierte bien', () => {
  const p = Q.analizarProducto({ forma: 'liquido', porcentaje: 4.763, base: 'disponible' });
  cerca(p.pctNaOCl, 5, 0.001, '% NaOCl');
});

test('1000 L de agua clara a 2 mg/L con cloro al 5 % → ≈ 39 mL', () => {
  const d = Q.calcularDosis(1000, 2, cloro5);
  cerca(d.mL, 39.06, 0.05, 'mL');
});

test('la dosis calculada deja exactamente la concentración pedida', () => {
  const d = Q.calcularDosis(1100, 4, cloro5);
  cerca(Q.concentracionResultante(1100, d.mL, cloro5), 4, 1e-9, 'concentración final');
});

test('granulado al 70 %: 1000 L a 50 mg/L → ≈ 71.4 g', () => {
  const d = Q.calcularDosis(1000, 50, { forma: 'granulado', porcentaje: 70 });
  cerca(d.gramos, 71.43, 0.01, 'gramos');
  cerca(d.pctTeoricoPuro, 99.18, 0.01, 'Ca(OCl)2 puro');
});

test('regla de Salud Pública (5 gotas por galón) con cloro al 5 % → ≈ 3.4 mg/L', () => {
  cerca(Q.concentracionReglaMSP(cloro5), 3.38, 0.02, 'regla MSP 5 %');
  // con cloro al 10 % la misma regla se pasa del límite de la OMS (5 mg/L)
  assert.ok(Q.concentracionReglaMSP({ forma: 'liquido', porcentaje: 10, base: 'NaOCl' }) > 5);
});

test('tiempo de contacto: 30 min con pH ≤ 8 y más tiempo con pH alto', () => {
  assert.equal(Q.tiempoContacto(7, 25).minutos, 30);
  assert.equal(Q.tiempoContacto(8, 25).minutos, 30);
  cerca(Q.tiempoContacto(8.5, 25).minutos, 78, 2, 'pH 8.5');
  assert.equal(Q.tiempoContacto(7, 15).minutos, 60); // agua fría
});

test('volúmenes por medidas', () => {
  cerca(Q.volumenCilindro(1, 1), 785.4, 0.1, 'cilindro 1 m × 1 m');
  assert.equal(Q.volumenRectangular(2, 1.5, 1), 3000);
  cerca(Q.aLitros(55, 'gal'), 208.2, 0.1, '55 galones');
  cerca(Q.aMetros(4, 'ft'), 1.2192, 1e-9, '4 pies');
});

test('dilución cuando se pasó de cloro', () => {
  assert.equal(Q.aguaParaDiluir(100, 10, 2), 400);
  assert.equal(Q.aguaParaDiluir(100, 1, 2), 0);
});

test('evaluación de la concentración', () => {
  assert.equal(Q.evaluarConcentracion(1), 'bajo');
  assert.equal(Q.evaluarConcentracion(2), 'ok');
  assert.equal(Q.evaluarConcentracion(4.8), 'alto');
  assert.equal(Q.evaluarConcentracion(6), 'excesivo');
});

test('decaimiento: el ajuste recupera k y C0 de datos exactos', () => {
  const puntos = [0.5, 2, 4, 8, 24].map((t) => ({ t, c: 2 * Math.exp(-0.05 * t) }));
  const a = Q.ajustarDecaimiento(puntos);
  cerca(a.k, 0.05, 1e-9, 'k');
  cerca(a.c0, 2, 1e-9, 'C0');
  cerca(a.r2, 1, 1e-9, 'R²');
  assert.equal(Q.ajustarDecaimiento([{ t: 1, c: 1 }]), null); // un punto no alcanza
  assert.equal(Q.ajustarDecaimiento([{ t: 1, c: 1 }, { t: 1, c: 0.8 }]), null); // misma hora
});

test('vida media y tiempo hasta 0.2 mg/L', () => {
  cerca(Q.vidaMedia(0.05), 13.863, 0.001, 't½');
  cerca(Q.tiempoHasta(2, 0.05, 0.2), 46.05, 0.01, 'horas hasta 0.2 mg/L');
  assert.equal(Q.tiempoHasta(0.1, 0.05, 0.2), 0);
  assert.equal(Q.tiempoHasta(2, 0, 0.2), Infinity);
});

test('Arrhenius: Ea calculada con dos experimentos es consistente', () => {
  const k2 = Q.kATemperatura(0.04, 26, 50000, 34);
  assert.ok(k2 > 0.04); // más calor, se gasta más rápido
  cerca(Q.energiaActivacion(0.04, 26, k2, 34), 50000, 1e-6, 'Ea');
});

test('Langelier: pHs y LSI de un agua de ejemplo', () => {
  const r = Q.langelier({ pH: 7.6, tempC: 28, durezaCalcica: 150, alcalinidad: 120, tds: 300 });
  cerca(r.A, 0.1477, 0.0001, 'A');
  cerca(r.B, 2.0312, 0.0001, 'B');
  cerca(r.C, 1.7761, 0.0001, 'C');
  cerca(r.D, 2.0792, 0.0001, 'D');
  cerca(r.pHs, 7.6237, 0.0005, 'pHs');
  cerca(r.lsi, -0.024, 0.001, 'LSI');
  // agua blanda y ácida → corrosiva; agua dura y alcalina → sarro
  assert.equal(Q.clasificarLangelier(Q.langelier({ pH: 6.5, tempC: 25, durezaCalcica: 20, alcalinidad: 15, tds: 100 }).lsi).tipo, 'corrosion');
  assert.equal(Q.clasificarLangelier(Q.langelier({ pH: 8.6, tempC: 30, durezaCalcica: 400, alcalinidad: 300, tds: 800 }).lsi).tipo, 'sarro');
  assert.equal(Q.clasificarLangelier(0.5).tipo, 'equilibrio');
  assert.equal(Q.clasificarLangelier(-1).nombre, 'Corrosión leve');
});

test('medidas caseras', () => {
  assert.equal(Q.medidaCasera(0.75).texto, '15 gotas');
  assert.equal(Q.medidaCasera(39).texto, '2 ½ cucharadas');
  assert.equal(Q.medidaCasera(5).texto, '1 cucharadita');
  assert.equal(Q.medidaCasera(977).texto, '4 tazas');
  assert.equal(Q.medidaCasera(2150).texto, '2 ¼ litros');
  assert.equal(Q.medidaCasera(2000).texto, '2 litros');
});
