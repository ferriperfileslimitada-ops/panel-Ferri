# Stage 1: Build the Vite Frontend
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

# Vite reads env vars from .env files, NOT from process.env
# Write .env.production so Vite bakes these into the JS bundle
RUN echo "VITE_SUPABASE_URL=https://supabase.ferriperfiles.com" > .env.production && \
    echo "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjMwODk3MTcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.NHDBLZCr12t_QN2ySG2zicMBFXRkh0f46ENKlenChCo" >> .env.production

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
