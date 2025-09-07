# FileBrowser

Token-protected file browser with admin operations. Backend in Express (TypeScript), JWT auth, strict filesystem confinement, minimal Tailwind + TypeScript frontend, full Docker/Compose support, and CI via GitHub Actions. Tests use Jest + ts-jest + supertest with 100% coverage.

## Highlights

- Auth: `POST /api/login` issues JWT (HS256). All routes require `Authorization: Bearer <token>`.
- Public: list directory tree and download files via streaming.
- Admin: move/rename (drag & drop in UI) and delete files/directories.
- Config-driven: single `configuration.json` at repo root (no env required; optional `PORT`).
- Frontend: single page in `public/` with Tailwind (CDN) and TypeScript; dark/light/system theme toggle.
- Quality: ESLint (strict), Prettier, Husky + lint-staged.
- Containers: multi-stage Dockerfile + docker-compose.
- CI: lint + test + build on every push/PR; separate Release workflow builds and pushes Docker image on tag.

## Requirements

- Node.js >= 20
- A writable folder to expose as the root of the file browser

## Project Structure

```
filebrowser/
├─ configuration.json
├─ src/                # Express app, routes, auth, fs helpers
├─ public/             # index.html + app.ts (compiled to app.js)
├─ tools/              # bcrypt hash generator
├─ .github/workflows/  # ci.yml, release.yml
├─ Dockerfile, docker-compose.yml
└─ jest/eslint/prettier/ts configs
```

## Configuration

Create `configuration.json` at project root:

```json
{
  "root": "/absolute/path/to/expose",
  "users": [
    { "username": "admin", "passwordHash": "<bcrypt>", "role": "admin" },
    { "username": "alice", "passwordHash": "<bcrypt>", "role": "user" }
  ],
  "auth": {
    "jwtSecret": "change-this-secret",
    "tokenTtlMinutes": 60
  }
}
```

Generate a bcrypt hash:

```
npm run hash -- "myPassword"
```

Notes:

- `root` must be an absolute path; all file operations are confined within this directory.
- Roles: `admin` can move/delete; `user` can browse/download.
- Tokens expire per `tokenTtlMinutes` and must be sent as Bearer auth.

## Local Development

Install dependencies and run tests:

```
npm ci
npm test
```

Lint and format check:

```
npm run lint
npm run format
```

Build (backend + frontend):

```
npm run build
```

Start the server:

```
npm start
# http://localhost:3000 (override with PORT if needed)
```

Iterate during development (watch server + compile frontend):

```
npm run dev
```

## Frontend Usage

- Open `http://localhost:3000`.
- Login with any user from `configuration.json`.
- After login:
  - Left pane: folders (droppable targets for moves).
  - Right pane: current directory contents.
  - Click a folder to navigate; click a file to download (streamed via fetch + blob).
  - Admin-only actions: drag a file onto a folder to move it; delete button on files.
- Theme toggle: button cycles System → Dark → Light; preference is stored in `localStorage` and applied on load. In System mode, the app follows the OS preference.

### Screenshots

- Light theme: docs/screenshots/light.png
- Dark theme: docs/screenshots/dark.png

Tip: toggle the theme using the header button (System/Dark/Light), then take a screenshot and place it under `docs/screenshots/` with those names.

## REST API

Base URL: `http://localhost:3000`

- POST `/api/login`
  - Body: `{ "username": string, "password": string }`
  - 200: `{ token: string, user: { username: string, role: 'admin'|'user' } }`
  - 400/401 on missing/invalid credentials
  - Example:
    ```bash
    curl -s http://localhost:3000/api/login \
      -H 'content-type: application/json' \
      -d '{"username":"admin","password":"secret"}'
    ```

- GET `/api/tree?path=<relative>`
  - Auth: `Authorization: Bearer <token>`
  - 200: `{ cwd, parent, items: [{ name, isDir, size|null, mtime }], user }`
  - 400 if not a directory; 403 if outside root
  - Example:
    ```bash
    curl -s 'http://localhost:3000/api/tree?path=.' -H "Authorization: Bearer $TOKEN"
    ```

- GET `/api/file?path=<relative>`
  - Auth: Bearer
  - Streams a file with proper headers
  - 400 if a directory; 403 if outside root
  - Example:
    ```bash
    curl -OJ 'http://localhost:3000/api/file?path=README.md' -H "Authorization: Bearer $TOKEN"
    ```

- POST `/api/move` (admin)
  - Auth: Bearer; Body: `{ from: string, to: string }` (relative paths)
  - 200 on success
  - Errors: 400 missing fields; 403 outside root or non-admin
  - Example:
    ```bash
    curl -s http://localhost:3000/api/move \
      -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" \
      -d '{"from":"a.txt","to":"sub/a.txt"}'
    ```

- DELETE `/api/file?path=<relative>` (admin)
  - Auth: Bearer; recursive deletion
  - 200 on success; 403 outside root or non-admin
  - Example:
    ```bash
    curl -s -X DELETE 'http://localhost:3000/api/file?path=sub/a.txt' -H "Authorization: Bearer $TOKEN"
    ```

All non-login endpoints require Bearer tokens. Errors return JSON `{ error: string }`.

## Quickstart Configurations

Example: minimal single-user admin for local testing (replace `passwordHash`):

```json
{
  "root": "/absolute/path/to/expose",
  "users": [
    {
      "username": "admin",
      "passwordHash": "$2b$10$REPLACE_ME",
      "role": "admin"
    }
  ],
  "auth": { "jwtSecret": "change-this-secret", "tokenTtlMinutes": 60 }
}
```

Generate a hash: `npm run hash -- "yourPassword"` and paste it into `passwordHash`.

Compose override to expose a host folder (edit `docker-compose.yml`):

```yaml
services:
  filebrowser:
    volumes:
      - ./configuration.json:/app/configuration.json:ro
      - /absolute/host/folder:/data
```

Then set `"root": "/data"` in `configuration.json`.

## Security Notes

- Confinement: all paths resolve via a safe resolver that normalizes and ensures the absolute path stays within `root`. Traversal attempts are rejected.
- Streaming: downloads use `fs.createReadStream` to avoid loading files into memory.
- Auth: JWT HS256 with configurable TTL; admin-only routes enforce `role==='admin'`.
- Logging: minimal info/warn/error logs; responses do not include stack traces.
- Symlinks: traversal outside root is blocked; broken symlinks are skipped when listing.

## Testing & Quality

- Jest + ts-jest with supertest (E2E without network) and jsdom for frontend helpers.
- Coverage is enforced at 100% (statements/branches/functions/lines) across backend and `public/app.ts`.
- Run tests:
  ```bash
  npm test
  ```
- Lint/format:
  ```bash
  npm run lint
  npm run format
  ```
- Husky pre-commit hook runs lint, tests (coverage), and Prettier check. `lint-staged` narrows scope to changed files.

## Docker

Build and run locally via Compose:

```bash
docker compose up --build
```

The container expects `configuration.json` at `/app/configuration.json` (Compose mounts it read-only). Port 3000 is exposed.

Run with plain Docker:

```bash
# Build image locally
docker build -t filebrowser:local .

# Run, mounting a config (and optionally a host folder)
docker run --rm -p 3000:3000 \
  -v "$PWD/configuration.json":/app/configuration.json:ro \
  -v /absolute/host/folder:/data \
  filebrowser:local
```

Use a published image from GHCR (release tags):

```bash
docker run --rm -p 3000:3000 \
  -v "$PWD/configuration.json":/app/configuration.json:ro \
  ghcr.io/<owner>/<repo>:<tag>
```

## CI (GitHub Actions)

- CI (`.github/workflows/ci.yml`): on every push/PR to any branch → `npm ci`, `npm run lint`, `npm test --coverage`, `npm run build`.
- Release (`.github/workflows/release.yml`): on tag push only → same steps as CI, then Docker build and push to GHCR as `ghcr.io/<owner>/<repo>:<tag>` and `:latest`.
  - Requires `permissions: packages: write` (granted by default `GITHUB_TOKEN`).

## Troubleshooting

- 401 Unauthorized: login first and pass `Authorization: Bearer <token>`.
- 403 Forbidden: the requested path escapes `root`, or your role is not admin.
- 400 errors:
  - `/api/tree` on a file → 400.
  - `/api/file` on a directory → 400.
  - `/api/move`/`DELETE /api/file` require admin role and valid payload.
- `configuration.json`: ensure absolute `root`, valid bcrypt hashes, and positive `tokenTtlMinutes`.
- Frontend downloads: use `fetch` + `blob` to include Bearer header; plain `<a>` will not send it.
- Theme not switching: perform a hard refresh to clear CDN cache; the app applies `dark` on `<html>` and includes a CSS fallback if CDN config lags.
