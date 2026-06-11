# Etapa 1: compila client (Vite) y server (tsc)
FROM node:20-alpine AS build
WORKDIR /app

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY server/package*.json ./server/
RUN cd server && npm ci

COPY client ./client
RUN cd client && npm run build

COPY server ./server
RUN cd server && npm run build

# Etapa 2: imagen final solo con runtime
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

USER node
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
