#!/bin/sh
# Corre las pruebas del módulo químico y, si pasan, publica la carpeta app/
# en GitHub Pages (rama gh-pages). Uso: ./publicar.sh
set -e
node --test pruebas/quimica.test.js
git push origin main
git subtree push --prefix app origin gh-pages
echo "Listo: https://gabrielabreu47.github.io/cloroseguro/ (tarda 1 o 2 minutos en actualizarse)"
