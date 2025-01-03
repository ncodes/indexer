echo "Waiting for eth-chain to start..."
# sleep for 20 seconds
sleep 20

echo "Running migrations..."
yarn mig:dev:up

echo "Starting indexer..."
node dist/src/main.js

