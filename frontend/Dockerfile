# ==============================================================================
# Build Stage: Compile Vite React Application
# ==============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build argument for API URL and Google OAuth Client ID at build time
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

ARG VITE_GOOGLE_CLIENT_ID=878245794947-aidf981hqs97v7j5emsnrrdoos5lmk7e.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# Compile optimized production bundle
RUN npm run build

# ==============================================================================
# Runtime Stage: Serve Production Assets via Nginx
# ==============================================================================
FROM nginx:alpine

# Remove default nginx site
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom Nginx configuration with SPA routing and Gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
