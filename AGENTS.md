# AGENTS.md — Generative Specification (Token Auth + Containers + CI)

> **Mission**: Generate a complete project "FileBrowser" that allows browsing, downloading, moving (drag‑and‑drop), and deleting files from a root directory defined in `configuration.json`. Authentication uses a **login endpoint** that returns a **token**; **all API calls require this token** (Bearer). Roles `user` and `admin` (only `admin` can move/delete). Minimal frontend in HTML/TS + Tailwind. Quality: strict TypeScript, Jest with **100% coverage** (statements/branches/functions/lines), ESLint + Prettier, Husky + lint‑staged hooks. The project must be **containerizable** (Dockerfile + docker‑compose.yml) and include a **GitHub Actions** workflow that runs lint+test+build on every commit, and **pushes the Docker image only on tag** (using the tag value as the image tag).

---

## 1) Scope & objectives

- **Public features** (behind auth):
  - List directory contents.
  - Download a file via streaming.
- **Admin features** (authenticated `role: "admin"`):
  - Move a file/directory (rename/move inside root).
  - Delete a file/directory (recursive allowed).
- **Config**: single `configuration.json` (no ENV variables needed, except optionally `PORT` for convenience).
- **Frontend**: single page `public/index.html` + TypeScript UI (login, navigation, drag‑and‑drop move, deletion), styled with **Tailwind**.
- **Containers**: first‑class Docker support (Dockerfile + docker‑compose.yml).
- **CI**: GitHub Actions workflow to lint+test+build on every push/PR; **push Docker image only when a tag is pushed**.

---

## 2) Technical requirements

- **Runtime**: Node.js ≥ 20.
- **Language**: strict TypeScript (`"strict": true`).
- **Server**: Express 4.x.
- **Auth**: Token‑based. Provide `POST /api/login` accepting JSON `{ username, password }` and returning `{ token, user }`. Use a **JWT** (HS256) signed with a secret stored in `configuration.json`.
- **FS**: strict confinement within root (path traversal protection). File downloads via **streaming**.
- **Quality**: Jest + ts‑jest, **100%** for **statements/branches/functions/lines**. ESLint (typescript‑eslint) + Prettier. Husky + lint‑staged (pre‑commit: lint, test --coverage, format check).
- **Style**: Tailwind CSS (CDN for MVP; structure ready for PostCSS if needed later).
- **Containers**: Multi‑stage Dockerfile (build TS → run on node:20‑alpine). Compose file for local dev.
- **CI**: GitHub Actions workflow `.github/workflows/ci.yml` as specified in §10.

---

## 3) Configuration schema

Place `configuration.json` at the project root:

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

- `root`: **absolute** path.
- `users[*].passwordHash`: BCrypt hash.
- `role`: `"admin" | "user"`.
- `auth.jwtSecret`: secret used to sign JWTs (HS256).
- `auth.tokenTtlMinutes`: token time‑to‑live (integer, minutes).

> Provide CLI `tools/hash.ts` to generate a BCrypt hash: `npm run hash -- "myPassword"` → prints hash to paste in `configuration.json`.

---

## 4) HTTP API (REST)

Base URL: `http://localhost:3000` (or container port, see Compose)

### 4.1 POST `/api/login`

- **Body**: `{ username: string, password: string }`.
- **Success**: `200` JSON `{ token: string, user: { username: string, role: 'admin'|'user' } }`.
- **Notes**: token is a JWT (HS256) signed with `auth.jwtSecret`, exp set to `tokenTtlMinutes`.
- **Errors**: `401` invalid credentials; `400` missing fields.

### 4.2 Auth for all other endpoints

- **Required**: `Authorization: Bearer <token>` header with a valid, unexpired JWT.
- **Errors**: `401` if missing/invalid/expired; `403` if role is insufficient for the action.

### 4.3 GET `/api/tree?path=<relative>`

- **Auth**: Bearer token required.
- **Response**: `200` JSON `{ cwd, parent, items: Array<{ name; isDir; size|null; mtime }>, user: {username, role} }`.
- **Errors**: `400` if not a directory; `403` if path escapes root.

### 4.4 GET `/api/file?path=<relative>`

- **Auth**: Bearer token required.
- **Behavior**: stream download with proper `Content-Type`, `Content-Disposition`, `Content-Length`.
- **Errors**: `400` if directory; `403` if outside root.

### 4.5 POST `/api/move` (admin)

- **Auth**: Bearer token; must have `role: admin`.
- **Body**: `{ from: string; to: string }` (paths relative to root).
- **Behavior**: create destination folder if needed; `rename`.
- **Errors**: `400` missing fields; `403` outside root or not admin.

### 4.6 DELETE `/api/file?path=<relative>` (admin)

- **Auth**: Bearer token; must have `role: admin`.
- **Behavior**: recursive deletion (`fs.rm` with `recursive:true, force:true`).

> **All** endpoints: minimal logging (info/warn/error), return JSON errors `{ error: string }` without stack traces.

---

## 5) Architecture & repo structure

```
filebrowser/
├─ configuration.json                 # provided by user
├─ package.json
├─ tsconfig.json
├─ jest.config.ts
├─ .eslintrc.cjs
├─ .prettierrc.json
├─ .prettierignore
├─ .eslintignore
├─ .husky/
│  └─ pre-commit                      # runs lint + test + format check
├─ .github/
│  └─ workflows/
│     └─ ci.yml                       # GH Actions workflow (see §10)
├─ Dockerfile
├─ docker-compose.yml
├─ src/
│  ├─ server.ts                       # entry point
│  ├─ config/
│  │  └─ config.ts                    # load/validate configuration.json
│  ├─ auth/
│  │  ├─ login.ts                     # POST /api/login handler
│  │  └─ bearer.ts                    # Bearer JWT middleware + role checks
│  ├─ fs/
│  │  ├─ pathSafe.ts                  # safe path resolution
│  │  └─ fileOps.ts                   # list/download/move/delete wrappers
│  ├─ routes/
│  │  ├─ tree.ts
│  │  ├─ file.ts
│  │  └─ admin.ts
│  ├─ utils/
│  │  └─ logger.ts                    # minimal logger
│  └─ types/
│     └─ index.d.ts
├─ tools/
│  └─ hash.ts                         # bcrypt hash generator
└─ public/
   ├─ index.html
   └─ app.ts                          # frontend TypeScript (compiled → public/app.js)
```

- Compile `public/app.ts` to `public/app.js` with `tsc` (no bundler for MVP).
- Tailwind via CDN (MVP) or optional PostCSS later.

---

## 6) Security requirements (must‑have)

- **Confinement**: all FS ops go through `resolveSafePath()`:
  - normalize requested path,
  - block `..` and variants,
  - resolve against root and ensure `abs.startsWith(root + path.sep)` or `abs === root`.
- **Streaming**: never load entire file in memory.
- **Auth**:
  - JWT: verify signature (HS256), expiration, and extract `{ username, role }`.
  - Admin routes must check `role==='admin'`.
- **Errors**: no stack traces in responses.

---

## 7) Frontend (Tailwind + TS)

- `public/index.html`:
  - Header with username/password form and _Login_ / _Logout_ buttons; show role badge after login.
  - Left: folder tree (droppable zones for move).
  - Right: current directory listing; click to open folders; download link for files; 🗑️ button (visible if admin).
  - Breadcrumb navigation.
- `public/app.ts`:
  - `login(username, password)` → `POST /api/login` → store `{ token, user }` in `sessionStorage`.
  - Attach `Authorization: Bearer <token>` to every API request.
  - Implement `fetchTree`, `renderList`, `renderTree`, drag‑and‑drop move, delete, and role‑based UI.
  - Never hardcode root; all paths are relative.

---

## 8) NPM scripts

- `dev`: `tsc -w` for src and `public/app.ts`, optional `nodemon` for server reload.
- `build`: `tsc` for backend + frontend TS compile.
- `start`: `node dist/server.js`.
- `test`: `jest --coverage`.
- `lint`: `eslint .`.
- `format`: `prettier --check .` (`format:write` to fix).
- `hash`: `ts-node tools/hash.ts` (or run from `dist/tools/hash.js`).
- `prepare`: Husky installation.

---

## 9) Jest configuration (100% everywhere)

- Use **ts‑jest**.
- Achieve **100%** for `statements`, `branches`, `functions`, `lines`.
- Cover both backend and critical frontend TS (`public/app.ts`).

Required settings:

- `collectCoverageFrom`: `['src/**/*.ts', 'public/app.ts']`.
- `coverageThreshold`:
  ```json
  {
    "global": {
      "statements": 100,
      "branches": 100,
      "functions": 100,
      "lines": 100
    }
  }
  ```
- Mock FS/Express for unit tests.
- Light E2E using **supertest** against the Express app (no network).

---

## 10) Containers & CI

### 10.1 Dockerfile (multi‑stage)

- **Stage 1 (builder)**: node:20‑alpine
  - Install deps (use `npm ci --omit=dev` only in runtime stage; in builder run full `npm ci`).
  - Build TypeScript (backend + `public/app.ts`).
- **Stage 2 (runtime)**: node:20‑alpine
  - Copy `dist/`, `public/`, `package*.json`, `configuration.json` (or mount at runtime), and production node_modules.
  - Default `CMD ["node", "dist/server.js"]` and `EXPOSE 3000`.

### 10.2 docker‑compose.yml

- Service `filebrowser`:
  - Build from `Dockerfile`.
  - Map host directory to a container path if you want to expose a local folder (bind mount optional).
  - Mount or copy `configuration.json`.
  - Ports: `3000:3000`.

### 10.3 GitHub Actions: `.github/workflows/ci.yml`

- Triggers: `push` and `pull_request` to any branch; **plus** `push` on tags (e.g., `v*`).
- Jobs:
  1. **ci** (always): checkout, setup Node 20, `npm ci`, `npm run lint`, `npm test --coverage`, `npm run build`.
  2. **docker-publish** (only on tag):
     - Needs `ci`.
     - Log in to container registry (default **GHCR**: `ghcr.io/<owner>/<repo>` using `${{ github.actor }}` and `${{ secrets.GITHUB_TOKEN }}` with `packages: write` permission).
     - Build and push Docker image tagged with the **git tag name** (e.g., `${{ github.ref_name }}`) and optionally `latest`.

> Ensure the workflow grants `permissions: packages: write` for GHCR. For Docker Hub, require secrets `DOCKERHUB_USERNAME/DOCKERHUB_TOKEN` and log in accordingly.

---

## 11) ESLint + Prettier

- ESLint with `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`.
- Recommended rules; forbid untyped `any`.
- Prettier for formatting (width 100/120, trailing commas, etc.).
- `lint-staged`: `eslint --fix` + `prettier --write` + `jest --bail --findRelatedTests`.

---

## 12) Tests to implement (exhaustive)

### 12.1 Unit — utils & auth

- `config.ts`: load/validate config (missing fields, types, root abs path, users validity, auth section presence, positive TTL).
- `bearer.ts`: rejects missing/invalid/expired tokens; accepts valid tokens; attaches `req.user` with `{username, role}`; role guard helper for admin.
- `login.ts`: accepts correct creds (bcrypt match) and issues JWT with proper claims and exp; rejects invalid creds.
- `pathSafe.ts`: path normalization/escape attempts blocked; resolve‑to‑root allowed.
- `logger.ts`: console spies.

### 12.2 Unit — fileOps

- `list(dir)`: returns items with `isDir/size/mtime`, sorted dirs first, then files alpha.
- `download(file)`: reject directory; expose metadata (mock `stat`).
- `move(from,to)`: creates parent; propagates FS errors.
- `remove(path)`: recursive deletion; correct flags.

### 12.3 Routes (supertest)

- `POST /api/login`: 200 on success, 401 on bad creds; token decodes to expected claims.
- `GET /api/tree`: 401 without token; 200 with token; 400 on file path; 403 on root escape.
- `GET /api/file`: 401 without token; 200 with token; 400 on directory.
- `POST /api/move`: 401 without token; 403 for non‑admin; 200 for admin; verify `rename` called.
- `DELETE /api/file`: 401 without token; 403 for non‑admin; 200 for admin; verify `rm` called.

### 12.4 Frontend (`public/app.ts`)

- `login()` stores token and user; builds Bearer header.
- DnD move logic with fake `DataTransfer`.
- Admin buttons visible only when `role==='admin'`.

> **Goal**: 100% overall coverage.

---

## 13) UX & frontend details

- _Login_ posts JSON creds, stores `{ token, user }` in `sessionStorage`.
- _Logout_ clears session and UI.
- Role badge reflects current user.
- Downloads via `<a href="/api/file?path=...">` with Bearer header (use fetch + blob if headers are required by server; otherwise allow direct link if server tolerates token via cookie — for MVP, prefer fetch + blob download to always pass Bearer).
- Drag: set `dataTransfer.setData('text/plain', relPath)`. Drop on folder (`.droppable`).
- Minimal error dialogs via `alert()` for MVP.

---

## 14) Local CI script (optional)

- `ci`: `npm run lint && npm test && npm run build`.

---

## 15) Acceptance (Definition of Done)

- `npm run build` produces `dist/` + `public/app.js`.
- `npm test` shows **100%** coverage (statements/branches/functions/lines).
- `npm start` serves the app at `http://localhost:3000`.
- All API routes require Bearer token and behave per spec; admin ops restricted to admins.
- FS confinement validated by tests (no root escape).
- `tools/hash.ts` works and is documented.
- **Docker**: image builds and runs; **docker‑compose** launches the service locally.
- **CI**: Actions workflow runs on pushes/PRs; pushes Docker image **only** on tag, using the tag as image tag.

---

## 16) Code conventions

- Strict TS; no untyped `any`.
- Thin routes; logic in modules (`fileOps`, `pathSafe`, `config`, `auth`).
- Pure, testable helpers where possible.

---

## 17) Generation steps (recommended order)

1. Bootstrap `package.json` (TypeScript, ts‑node/tsx, jest, ts‑jest, supertest, eslint, prettier, husky, lint‑staged, bcryptjs, jsonwebtoken, express, mime‑types, @types/\*,…).
2. Configs: `tsconfig.json`, `jest.config.ts`, `.eslintrc.cjs`, `.eslintignore`, `.prettierrc.json`, `.prettierignore`, Husky `pre-commit`, `lint-staged`.
3. Schema: create example `configuration.json`.
4. Backend: `server.ts`, `config/config.ts`, `auth/login.ts`, `auth/bearer.ts`, `fs/pathSafe.ts`, `fs/fileOps.ts`, `routes/*`, `utils/logger.ts`.
5. Frontend: `public/index.html` (Tailwind CDN), `public/app.ts` (login + Bearer on fetch).
6. Tool: `tools/hash.ts`.
7. Tests: unit + supertest + frontend utils.
8. Docker: `Dockerfile` (multi‑stage), `docker-compose.yml`.
9. CI: `.github/workflows/ci.yml` with conditional Docker push on tags.
10. NPM scripts: `build`, `start`, `dev`, `test`, `lint`, `format`, `hash`, `prepare`.
11. README with setup, hashing, run, Docker usage, and CI notes.

---

## 18) Notes & edge cases

- **Symlinks**: treat carefully; disallow escaping root via symlink resolution (document behavior; optional `realpath` checks if implemented).
- **Large files**: stream and handle aborts.
- **Filenames**: support UTF‑8; URL‑encode in requests.
- **Downloads with Bearer**: most browsers don’t send headers on plain `<a>` download; prefer `fetch` + blob + `URL.createObjectURL` to include Bearer header.
- **Port**: allow `PORT` override via env for container runtime convenience (not required by spec, but helpful for Docker).

---

## 19) Deliverables

- Complete, runnable repo.
- Test suite with **100%** coverage.
- Dockerfile + docker‑compose.yml working locally.
- GitHub Actions workflow pushing image on tag with tag‑based image label.
- Clean, formatted code; lint passes; pre‑commit hook active.

---

## 20) Evaluation criteria

- Correct, enforced FS confinement.
- Clear separation of concerns; maintainable code.
- Stable tests; no flakiness.
- Functional token auth (JWT), proper role checks.
- Developer experience: one‑command build/run locally and in containers; CI doing the right thing on tags.

> When these are satisfied, the project is **Done**.
