# Indexer

The indexer indexes the events emitted by the Joint Protocol's contracts. It watches for events, transforms them and stores them in a database. The indexer also offers a REST API service for querying the database. Joint Interfaces can leverage these APIs to access the protocol state.

## Pre-requisites

- Node.js v18.18.2
- Yarn v1.22.22
- Redis
- Postgres v14
- Docker (optional)

## Installation

Run the following command in the root to install the dependencies:

```shell
yarn
```

## Configuration

The `.env.example` file contains the environment variables that need to be set for the indexer to run. Provide the values for every variable and rename the file to `.env`.

## Migration

After creating a Postgres database and setting the `DATABASE_URL` or `DATABASE_URL_TEST` (for testing) environment variable in the `.env` file, run the following command to run the migrations:

```shell
yarn mig:dev:up # for development
yarn mig:test:up # for testing
yarn mig:prod:up # for production
```

This will create the required tables in the database.

## Run (Development)

If you have the Postgres and Redis databases running outside a container, you can start the indexer on your terminal by running the following command:

```sh
yarn start:dev
```

## Run (Production)

```sh
yarn build
yarn start:prod
```
