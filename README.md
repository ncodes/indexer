# FIATX API

The FIATX backend service.

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Test

```bash
# unit tests
$ yarn test
```

## Authorization

Most routes require a user session token to be passed in the `Authorization` header.

## Set Up

### Database

- Create 2 database `accounts` (for dev) and `accounts_test` (for testing).
- Run migration `yarn mig:dev:up` for development env.
- Run migration `yarn mig:test:up` for test env.
- For production: specify connection URL using `DATABASE_URL` env. variable, then run `yarn mig:prod:up`.

### Required Environment Variables

- `APP_NAME` - The application name.
- `NODE_ENV` - The current node environment.
- `URL` - The API URL.
- `JWT_SECRET` - The JWT secret key for session token creation.
- `JWT_EXP_MIN` - The duration (in minutes) a JWT session token is allowed to last for.
- `JWT_FACTOR_TOKEN_EXP_MIN` - The duration (in minutes) a factor token is allowed to last for.
- `SPARKPOST_KEY` - Sparkpost API Key
- `TWILIO_SID` - Twilio account ID
- `TWILIO_AUTHTOKEN` - Twilio authentication token
- `TWILIO_SERVICEID` - Twilio Verify service ID
- `NOMICS_KEY` - Nomics API Key
- `REDIS_URL` - Redis service URL
