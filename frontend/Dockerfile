# ==============================================================================
# Stage 1: Build Stage (Vite React Application in Monorepo Context)
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy root monorepo package manifests and frontend package manifest
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install frontend dependencies using root lockfile
RUN npm ci --workspace=frontend

# Copy frontend source code and configuration
COPY frontend/ ./frontend/

# Build production bundle with TypeScript check and Vite
RUN npm --workspace=frontend run build

# ==============================================================================
# Stage 2: Production Nginx Serving Stage
# ==============================================================================
FROM nginx:1.27-alpine AS runner

# Remove default boilerplate files
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
