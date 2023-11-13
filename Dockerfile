FROM node:18.18.0

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --legacy-peer-deps

# Bundle app source
COPY . .

# Build app
RUN npm run build

# Start app
CMD chmod +x ./scripts/run.sh && ./scripts/run.sh