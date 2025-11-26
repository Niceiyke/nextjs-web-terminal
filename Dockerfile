# Use a Node.js 20 LTS image as the base
FROM node:20-alpine AS base

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy necessary files from the base stage
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/server.js ./server.js
COPY --from=base /app/src ./src
COPY --from=base /app/public ./public

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]