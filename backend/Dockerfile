FROM node:20-slim

# Install build dependencies for C++ addon and Prisma
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build native addon explicitly
RUN npm run build:native

# Generate Prisma Client
RUN npm run prisma:generate

# Build the application (TS -> JS and copy native addon)
RUN npm run build

# Explicitly copy native addon to dist (ensure it exists for production)
RUN npm run copy-native

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
