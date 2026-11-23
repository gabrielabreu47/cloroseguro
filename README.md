# CloroSeguro

Web que calcula cuánto cloro echarle al agua de un tinaco, cisterna o botellón, cuándo volver a clorar y si el agua corroe las tuberías o forma sarro. Proyecto ABP de Química (aplicación de los principios químicos a la tecnología).

**Web:** https://gabrielabreu47.github.io/cloroseguro/

Funciona en el celular y se puede instalar como app. Después de abrirla una vez, funciona sin internet.

## Módulos

| Pestaña | Qué hace | Química |
| --- | --- | --- |
| Dosis | mL de cloro y tiempo de espera para cualquier recipiente | Cloro disponible, dilución, equilibrio HOCl/OCl⁻, C·t |
| Corregir | Qué concentración quedó si se echó cloro "al ojo" | Dilución |
| Decaimiento | Ajusta las mediciones con tiras, calcula k y cuándo volver a clorar | Cinética de primer orden, Arrhenius |
| Corrosión | Índice de Langelier: ¿el agua corroe o forma sarro? | Equilibrio de solubilidad del CaCO₃ |
| Química | Gráfica interactiva y reacciones | Henderson–Hasselbalch, redox |

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `app/js/quimica.js` | Módulo químico: todas las fórmulas, como funciones puras |
| `app/js/app.js` | Interfaz: lee los formularios y muestra resultados |
| `app/index.html`, `app/css/estilos.css` | Estructura y diseño |
| `app/sw.js`, `app/manifest.webmanifest` | Modo sin internet e instalación en el celular |
| `pruebas/quimica.test.js` | 17 pruebas automáticas del módulo químico |
| `publicar.sh` | Corre las pruebas y publica la web |

## Correr en la computadora

Doble clic en `app/index.html`, o:

```bash
python3 -m http.server 8000 --directory app
```

## Pruebas

Con Node.js 18 o más reciente:

```bash
node --test pruebas/quimica.test.js
```

## Publicar cambios

La web sale de la rama `gh-pages`, que contiene solo la carpeta `app/`. Después de hacer commit en `main`:

```bash
./publicar.sh
```

Si cambias archivos de la app, sube también el número de `VERSION` en `app/sw.js` para que los celulares descarguen la versión nueva.

## Fórmulas

1. Cloro disponible: % NaOCl × (70.906 / 74.442), pasado a mg/L con la densidad.
2. Dilución: C₁·V₁ = C₂·(V_agua + V₁).
3. Equilibrio HOCl ⇌ H⁺ + OCl⁻: α = 1 / (1 + 10^(pH − pKa)).
4. pKa según la temperatura (Morris, 1966): pKa = 3000/T − 10.0686 + 0.0253·T.
5. Tiempo de contacto (C·t): 30 min × máx(1, α(pH 8) / α(pH)).
6. Decaimiento: C(t) = C₀·e^(−kt), ajustado por mínimos cuadrados sobre ln C; Arrhenius: Ea = R·ln(k₂/k₁) / (1/T₁ − 1/T₂).
7. Langelier (1936): LSI = pH − pHs, con pHs = (9.3 + A + B) − (C + D).

Valores de referencia: OMS (≥ 0.5 mg/L tras 30 min con pH < 8; valor guía 5 mg/L; 0.2 mg/L mínimo en el punto de consumo), CDC Safe Water System (2 mg/L agua clara, 4 mg/L turbia), OMS Nota Técnica 3 (desinfección de tanques ≈ 50 mg/L por 24 h), rangos del LSI de la Universidad de Georgia (Saha y Hawkins).
