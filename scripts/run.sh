#!/bin/bash
# Entry point for an indexer docker container.
nohup redis-server &> redis.log & node dist/src/main.js