# Skillora Production Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose default port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
