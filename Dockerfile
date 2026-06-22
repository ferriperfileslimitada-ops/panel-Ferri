# Stage 1: Build the Vite Frontend
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

# Vite bakes VITE_* env vars into the JS bundle at build time
ARG VITE_SUPABASE_URL=https://supabase.ferriperfiles.com
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjMwODk3MTcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.NHDBLZCr12t_QN2ySG2zicMBFXRkh0f46ENKlenChCo
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
