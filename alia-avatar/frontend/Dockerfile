FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy code
COPY . .

# Build
RUN npm run build

# Expose
EXPOSE 3000

# Run
CMD ["npm", "run", "dev"]
