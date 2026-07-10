# Development & Setup

How to run **Catán Assistant** locally, with or without Docker. For what the app
is and how it's built, see the [README](../README.md).

## Requirements

- Node.js ≥ 18 and npm ≥ 9 (to run outside Docker)
- Docker + Docker Compose (for MongoDB and/or the full app)

## Configuration

```bash
cp .env.example .env
# Edit JWT_SECRET (use a long, random value) and, optionally, the mongo credentials.
```

Environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port (Express + Socket.IO) | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://catan:...@localhost:27017/catan?authSource=admin` |
| `JWT_SECRET` | Secret used to sign JWTs | — (required in production) |
| `MONGO_INITDB_ROOT_USERNAME/PASSWORD` | Credentials for the mongo container | `catan` / `catan-dev-password` |

> If MongoDB is unavailable, the app still works for **playing** (in-memory rooms,
> guest mode); only accounts and result persistence are disabled.

## Installation

```bash
npm run install:all
```

## Development (DB in Docker, code local)

```bash
npm run docker:db   # start only mongo (docker compose up -d mongo)
npm run dev
```

- Server with `tsx watch` on `http://localhost:3001`.
- Client with Vite on `http://localhost:5173` (proxies `/socket.io` and `/api` to
  the server; listens on the local network so you can test from phones).

## Local production (single process, single port)

```bash
npm run build
npm start
```

- `build` compiles the client to `client/dist`.
- `start` boots the server, which serves the client static files and the SPA
  fallback on `PORT` (3001).

## Everything in Docker

```bash
docker compose up --build
```

Starts `mongo` (persistent `mongo-data` volume) and `server` (multi-stage
`node:20-alpine` image, non-root user) serving the full app on
`http://localhost:3001`.

```bash
npm run docker:down   # stop everything
```

## Tests

```bash
npm test
```

Vitest covers the pure game logic:

- `rules.ts`: distribution with a limited bank, discards after a 7, bank/port
  trade ratios.
- `setup.ts`: build-table validation, derivation of production hexes (merge by
  number + resource, desert with robber, robber position preserved on edit) and
  the initial resource deal with a limited bank.
- `achievements.ts`: achievement catalog, XP and level math.
