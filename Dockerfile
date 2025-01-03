FROM node:18.18.2-alpine3.17

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install python/pip
ENV PYTHONUNBUFFERED=1
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools
RUN apk add g++ make

# Install git
RUN apk add git yarn

# Install app dependencies
RUN yarn
RUN yarn add wait-on

# Bundle app source
COPY . .

# Build app
RUN yarn build

# Start app
CMD ["sh", "./dev/run.sh"]