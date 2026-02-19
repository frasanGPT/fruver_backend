#!/usr/bin/env bash
set -euo pipefail

# Carga .env al entorno del shell
set -a
source .env
set +a

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
AUTH_HEADER="Authorization: Bearer ${DEV_BEARER_TOKEN}"

echo "1) Abrir caja..."
OPEN_RES=$(curl -s -X POST "$BASE_URL/api/cajas/abrir" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"usuario":"cajero1","saldoInicial":0}')

ID=$(echo "$OPEN_RES" | node -p "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(j.ok!==true) throw new Error(j.error); j.data._id")
echo "CAJA_ID=$ID"

echo "2) Actualizar totales..."
curl -s -X PATCH "$BASE_URL/api/cajas/$ID/totales" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"efectivo":12000,"qr":5000,"debito":30000}' | node -p "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); j.ok"

echo "3) Cerrar caja..."
curl -s -X POST "$BASE_URL/api/cajas/$ID/cerrar" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"conteoFisicoTotal":47000,"observaciones":"Demo cierre","aprobadoPor":"supervisor1"}' \
  | node -p "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(j.ok!==true) throw new Error(j.error); ({cajaEstado:j.data.caja.estado,totalSistema:j.data.arqueo.totalSistema,diferencia:j.data.arqueo.diferencia,conteoFisicoTotal:j.data.arqueo.conteoFisicoTotal,conteoFisicoEfectivo:j.data.arqueo.conteoFisicoEfectivo})"

echo "OK ✅"
