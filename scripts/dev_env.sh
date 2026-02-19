#!/usr/bin/env bash
set -a
source .env
set +a

echo "DEV_BEARER_TOKEN cargado (len=${#DEV_BEARER_TOKEN})"
echo "NODE_ENV=$NODE_ENV"
