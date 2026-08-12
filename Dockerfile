# syntax=docker/dockerfile:1.7

FROM node:20.19.4-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY package.json ./

RUN npx tsc --project tsconfig.build.json && npm prune --omit=dev

FROM node:20.19.4-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8000

WORKDIR /app

RUN groupadd --system --gid 1001 mcp \
  && useradd --system --uid 1001 --gid mcp --create-home mcp

COPY --from=build --chown=mcp:mcp /app/package.json /app/package-lock.json ./
COPY --from=build --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=build --chown=mcp:mcp /app/dist ./dist

USER mcp

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/http.js"]
