#!/bin/bash
# Run an indexer docker container connected to postgres and redis databases
# which are connected to the devnet network.
docker run \
    --name indexer \
    -p3001:3001 \
    --env-file=.env \
    -e DATABASE_URL=postgres://postgres:postgres@dev-db:5432/postgres?sslmode=disable \
    -e REDIS_URL=redis://redis:6379 \
    --network devnet \
    -d \
    indexer-service
    