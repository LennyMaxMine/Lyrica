# Build stage for client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server dependencies
COPY package*.json ./
COPY server/ ./server/

# Install production dependencies
RUN npm ci --production

# Copy built client from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 912

# Start the server
CMD ["node", "server/index.js"]
