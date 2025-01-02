FROM node:18.18.2-alpine3.17

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install git
RUN apk add git yarn

# Install app dependencies
RUN yarn

# Bundle app source
COPY . .

# Build app
RUN npm run build

# Start app
CMD sh ./dev/run.sh