# Portable single-image build: builds the PWA, then runs the backend which
# serves both the API and the static PWA. Works on Fly.io, Railway, Cloud Run,
# or any container host. Provide DATABASE_URL (and DATABASE_SSL=true for managed
# Postgres) at runtime.

# ---- Stage 1: build the frontend ----
FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: runtime (backend + built PWA) ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
# Place the built PWA where the backend expects it (../../frontend/dist).
COPY --from=frontend /build/frontend/dist /app/frontend/dist

EXPOSE 4000
# Run migrations, then start the server.
CMD ["sh", "-c", "npm run migrate && npm start"]
