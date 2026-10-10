# Brain Nuggets on Cloud Run: one container serves the React app and the /api routes.

# 1. Build the React app
FROM node:22-slim AS build
WORKDIR /app
COPY brain-nuggets/package.json brain-nuggets/package-lock.json ./
RUN npm ci
COPY brain-nuggets/ ./
RUN npm run build

# 2. Runtime: production dependencies, the server and the built app
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY brain-nuggets/package.json brain-nuggets/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY brain-nuggets/server ./server
COPY --from=build /app/dist ./dist
# Cloud Run sets PORT (8080 by default); GEMINI_API_KEY comes from the service's env/secrets.
EXPOSE 8080
CMD ["node", "server/index.js"]
