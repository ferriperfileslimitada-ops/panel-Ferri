# Stage 1: Build the Vite Frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build the Express Backend and serve
FROM node:18-alpine
WORKDIR /app

# Copy Backend package and install production dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy backend source code
COPY server/ ./

# Copy built frontend from Stage 1
COPY --from=builder /app/dist ./dist

# Expose the API port
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]
