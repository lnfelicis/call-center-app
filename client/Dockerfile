# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.18.0-alpine3.23
ARG NGINX_IMAGE=nginx:1.31.2-alpine3.23

FROM ${NODE_IMAGE} AS dependencies
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter client...

FROM dependencies AS build
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY client client
RUN pnpm --filter client build

FROM ${NGINX_IMAGE} AS runtime
COPY client/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/client/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
