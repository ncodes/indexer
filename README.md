# Indexer

The Indexer indexes the events emitted by the Joint Protocol's contracts. It watches for these events, transforms them and stores the output for more advanced querying. The indexer also offers a REST API service that can be accessed by external applications (e.g mobile apps, web apps, etc).

## Pre-requisites

- Node.js v18.18.2
- Yarn v1.22.22
- Redis
- Postgres v14
- Docker

## Installation

Run the following command in the root to install the dependencies:

```shell
yarn
```

## Configuration

The `.env.example` file contains the environment variables that need to be set for the indexer to run. Provide the values for every variable and rename the file to `.env`.

## Chain Configuration

The indexer is designed to work with the Joint Protocol's contracts deployed on the Ethereum network. The `LOCALHOST_RPC_URL` environment variable should be set to the URL of the Ethereum network running locally. See the [Contracts](https://github.com/jointlabs/contracts) repository for more information on how to run and deploy Joint contracts on a local Ethereum network.

## DB Config and Migration

After creating a Postgres database and setting the `DATABASE_URL` or `DATABASE_URL_TEST` (for testing) environment variable in the `.env` file, run the following command to run the migrations:

```shell
yarn mig:dev:up # for development
yarn mig:test:up # for testing
yarn mig:prod:up # for production
```

This will create the required tables in the database.

## Run (Development)

If you have the Postgres and Redis databases running, you can start the indexer on your terminal by running the following command:

```sh
yarn start:dev
```

## Run (Production)

```sh
yarn build
yarn start:prod
```

## With Docker Compose

The repository contains a `docker-compose.yaml` file that will start containers for postgres, redis, local chain and the indexer. To start the indexer with Docker, run the following command:

```sh
docker compose up
```

If you want to start the containers individually, you can run the following commands:

#### Run Postgres DB

```sh
yarn docker:db:start
```

#### Run Redis

```sh
yarn docker:redis:start
```

#### Run Local Chain

```sh
yarn docker:chain:start
```
