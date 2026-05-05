# Use Node.js 18 alpine image for smaller size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port (default 4000, can be overridden)
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
