echo "Running migrations..."
yarn mig:dev:up

echo "Starting indexer..."
node dist/src/main.js

