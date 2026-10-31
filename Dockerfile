# Cloud Run image for the wedding page (Next.js standalone output).
# Built and pushed by .github/workflows/deploy.yml, tagged with the full git SHA.

ARG NODE_IMAGE=node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Node >= 25 no longer bundles corepack: install a pinned version, then pnpm from packageManager.
ARG COREPACK_VERSION=0.36.0
RUN npm install --global "corepack@${COREPACK_VERSION}" && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8080
# server.js (standalone) listens on $PORT, which Cloud Run sets.
CMD ["node", "server.js"]
