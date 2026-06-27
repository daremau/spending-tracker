#!/usr/bin/env bash
# One-command local dev: starts Postgres in Docker, syncs schema, seeds,
# then runs `next dev` on the host for fast native hot reload.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Starting PostgreSQL (Docker)…"
docker compose up -d --wait db

echo "▶ Applying schema + regenerating Prisma client…"
npx prisma db push

echo "▶ Seeding default categories (skips if they already exist)…"
npx prisma db seed

echo "▶ Starting Next.js dev server on http://localhost:3000"
exec npx next dev
