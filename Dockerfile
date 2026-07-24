# ==========================================
# Stage 1: Build Vite React application
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for efficient caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Accept Supabase environment variables at build-time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_IPL_FINDER_URL
ARG VITE_REKAP_VIEWER_URL
ARG VITE_COMMUNITY_DOCS_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_IPL_FINDER_URL=$VITE_IPL_FINDER_URL
ENV VITE_REKAP_VIEWER_URL=$VITE_REKAP_VIEWER_URL
ENV VITE_COMMUNITY_DOCS_URL=$VITE_COMMUNITY_DOCS_URL

# Accept Git Commit SHA, Branch, and Version at build-time
ARG VITE_GIT_SHA
ARG VITE_GIT_BRANCH
ARG VITE_APP_VERSION
ENV VITE_GIT_SHA=$VITE_GIT_SHA
ENV VITE_GIT_BRANCH=$VITE_GIT_BRANCH
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Build production static assets (this reads .env variables at build time)
RUN npm run build

# ==========================================
# Stage 2: Serve static files with Nginx
# ==========================================
FROM nginx:alpine

# Copy built bundle from Stage 1 to Nginx HTML root
COPY --from=build /app/dist /usr/share/nginx/html

# Overwrite Nginx default configuration with our custom SPA router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (standard HTTP port served by fly.io)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
