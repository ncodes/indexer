FROM node:18.18.2-alpine3.17

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install git
RUN apk add git

# Install app dependencies
RUN npm install --legacy-peer-deps

# Bundle app source
COPY . .

# Build app
RUN npm run build

# Start app
CMD chmod +x ./dev/run.sh && ./dev/run.sh