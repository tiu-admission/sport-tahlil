#!/usr/bin/env bash
# SportTahlil — lokal ishga tushirish
# Ishlatish:  bash run.sh    (keyin brauzerda http://localhost:8000 ni oching)
cd "$(dirname "$0")"
echo "SportTahlil ishga tushmoqda -> http://localhost:8000  (to'xtatish: Ctrl+C)"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
