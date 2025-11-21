# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build arguments for Vite
ARG VITE_BACKEND_URL
ARG VITE_WS_URL
ARG VITE_USE_CLUSTER
ARG VITE_CLUSTER_NODES

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_USE_CLUSTER=$VITE_USE_CLUSTER
ENV VITE_CLUSTER_NODES=$VITE_CLUSTER_NODES

RUN npm run build

# Production Stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
