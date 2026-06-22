# Stage 1: Build the Vite Frontend
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Build the Express Backend and serve
FROM node:22
WORKDIR /app

# Copy Backend package and install production dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production --legacy-peer-deps

# Copy backend source code
COPY server/ ./server/

# Copy built frontend from Stage 1
COPY --from=builder /app/dist ./dist

# Expose the API port
EXPOSE 3001

# Start the server
ENV PORT=3001
CMD ["node", "server/index.js"]
