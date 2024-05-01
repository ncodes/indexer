#!/bin/bash
# Run an indexer docker container connected to a local postgres database and 
# a local .env file.
docker run \
    --name indexer \
    -p3001:3001 \
    --rm \
    --env-file=.env \
    -e DATABASE_URL=postgres://postgres:@host.docker.internal:5432/joint?sslmode=disable \
    -e REDIS_URL=redis://host.docker.internal:6379 \
    -e LOCALHOST_RPC_URL=http://host.docker.internal:8545 \
    -d \
    indexer-service