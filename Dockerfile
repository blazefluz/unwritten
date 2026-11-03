FROM node:22-bookworm-slim AS build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
COPY examples/ /app/examples/
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN python3 -m venv .venv && .venv/bin/pip install --no-cache-dir 'openai>=1.60'
COPY unwritten/ ./unwritten/
COPY examples/ ./examples/
COPY evaluation/training-cable-final.session.json ./evaluation/training-cable-final.session.json
COPY evaluation/zipper-pilot/workflow.json ./evaluation/zipper-pilot/workflow.json
COPY --from=build /app/web/.next ./web/.next
COPY --from=build /app/web/node_modules ./web/node_modules
COPY --from=build /app/web/public ./web/public
COPY --from=build /app/web/package.json ./web/package.json
RUN chown -R node:node /app
USER node
WORKDIR /app/web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 UNWRITTEN_DEMO_ONLY=true
EXPOSE 10000
CMD ["sh", "-c", "./node_modules/.bin/next start --hostname 0.0.0.0 --port ${PORT:-10000}"]
