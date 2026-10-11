# Contexto de build = raiz do repositorio:  docker build -t trixtecnologia/barberbattle-server:<tag> -f servidor/Dockerfile .
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY servidor/package.json servidor/package-lock.json ./servidor/
RUN cd servidor && npm ci --omit=dev --no-audit --no-fund
COPY index.html LICENCAS.txt ./
COPY src ./src
COPY servidor ./servidor
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "servidor/index.js"]
