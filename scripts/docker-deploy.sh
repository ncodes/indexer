#!/bin/bash
# Run an ephmeral indexer docker container
docker run \
    --name indexer \
    --rm \
    -p80:80 \
    --env-file=.env \
    -d \
    indexer-service
    