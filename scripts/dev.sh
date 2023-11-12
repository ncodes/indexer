#!/bin/bash
# Run an indexer docker container connected to a local postgres database and 
# a local .env file.
docker run \
    -p3001:3001 \
    --env-file=.env \
    -e DATABASE_URL=postgres://postgres:@host.docker.internal:5432/joint?sslmode=disable \
    -d \
    indexer-service