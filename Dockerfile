# Build stage for client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./
RUN npm install

COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server dependencies
COPY package.json package-lock.json* ./
COPY server/ ./server/

# Install production dependencies
RUN npm install --production

# Copy built client from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 1027

# Set environment
ENV NODE_ENV=production
ENV PORT=1027

# Start the server
CMD ["node", "server/index.js"]
