# API Workbench

A lightweight, developer-focused API client built as a practical alternative to subscription-heavy tooling.

**Repo:** `DeonW169/api-workbench`  
**GitHub:** <https://github.com/DeonW169/api-workbench>

---

## Why this exists

For years, tools like Postman have been the default for testing APIs. This project was built to provide a leaner, more affordable, self-hosted alternative with the features developers use most often, without the noise of enterprise-only functionality.

API Workbench is currently focused on:

- fast local setup
- clean request building
- reusable collections and folders
- variable-driven execution
- response inspection
- basic assertions and collection runs
- cURL interoperability

It is intentionally **web-based first**, with a split architecture:

- **Angular + Angular Material frontend** for the UI
- **Fastify backend request runner** for executing outbound HTTP requests
- **Dexie / IndexedDB** for local-first persistence in the browser

This avoids many of the browser-side CORS and secret-handling limitations you would hit in a frontend-only API client.

---

## Current feature set

### Core request workflow
- Create and execute HTTP requests
- Supported methods:
  - `GET`
  - `POST`
  - `PUT`
  - `PATCH`
  - `DELETE`
- Configure:
  - URL
  - query parameters
  - headers
  - auth
  - body

### Collections and workspace
- Save requests locally
- Organize requests into **collections** and **folders**
- Open multiple requests in **tabs**
- Track unsaved request changes in the workspace
- Reopen and edit existing saved requests

### Request body support
- No body
- Raw JSON
- Raw text
- `x-www-form-urlencoded`
- `multipart/form-data`
- File uploads through the backend runner

### Response tooling
- Response status, duration, size, and headers
- JSON tree viewer
- Search inside response payloads
- Expand / collapse JSON structures
- Raw response view
- Copy actions
- Download response content
- Inline image preview for image responses

### Variables and environments
- Global variables
- Collection variables
- Environment variables
- Variable precedence support
- Secret masking in the UI
- Import / export for variables and environments
- Resolved request preview before execution

### Dynamic variables
Supports generated values such as:
- timestamp
- ISO datetime
- UUID
- random integer
- random string
- current date

### Assertions
Basic test assertions can be attached to requests, including:
- status equals
- body contains
- header exists
- JSON path exists
- JSON path equals

### Collection runner
- Run all requests in a folder or collection sequentially
- Stop on failure
- Delay between requests
- Summary of run results
- Assertion-aware execution results

### cURL import / export
- Export a request as cURL
- Import common cURL commands into a new editable request

### Local-first persistence
Stored locally in the browser using IndexedDB via Dexie:
- collections
- folders
- requests
- environments
- globals
- history
- workspace-related state

---

## Architecture

```text
┌───────────────────────────────────────────┐
│ Angular 21 + Angular Material frontend   │
│ - request editor                         │
│ - collections tree                       │
│ - environments                           │
│ - response viewer                        │
│ - assertions + runner UI                 │
│ - local IndexedDB persistence            │
└──────────────────────┬────────────────────┘
                       │ HTTP
                       ▼
┌───────────────────────────────────────────┐
│ Fastify request-runner backend           │
│ - executes outbound HTTP requests        │
│ - supports JSON / text / forms / files   │
│ - returns normalized response payloads   │
│ - previews image responses               │
└───────────────────────────────────────────┘
```

---

## Tech stack

### Frontend
- Angular 21
- Angular Material
- TypeScript
- SCSS
- Dexie
- dexie-export-import

### Backend
- Node.js
- TypeScript
- Fastify
- `@fastify/cors`
- `tsx`

---

## Repository structure

```text
api-workbench/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── types/
│   │   └── server.ts
│   └── package.json
└── web/
    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   │   ├── api/
    │   │   │   ├── state/
    │   │   │   ├── storage/
    │   │   │   └── utils/
    │   │   ├── features/
    │   │   │   ├── collections/
    │   │   │   ├── environments/
    │   │   │   ├── globals/
    │   │   │   ├── history/
    │   │   │   ├── home/
    │   │   │   ├── requests/
    │   │   │   └── responses/
    │   │   ├── layout/
    │   │   └── shared/
    │   └── ...
    └── package.json
```

---

## Prerequisites

Recommended local setup:
- Node.js 20+
- npm
- Git

You will run the frontend and backend as **two separate local processes**.

---

## Getting started

### 1) Clone the repository

```bash
git clone https://github.com/DeonW169/api-workbench.git
cd api-workbench
```

### 2) Install frontend dependencies

```bash
cd web
npm install
```

### 3) Install backend dependencies

Open a second terminal:

```bash
cd api-workbench/server
npm install
```

---

## Running locally

### Start the backend

From `server/`:

```bash
npm run dev
```

This starts the Fastify request runner on:

```text
http://localhost:3000
```

Health check:

```text
GET http://localhost:3000/api/health
```

### Start the frontend

From `web/`:

```bash
npm start
```

This starts the Angular development server on:

```text
http://localhost:4200
```

The frontend is configured to call the backend runner locally.

---

## Available scripts

### Frontend (`/web/package.json`)

```bash
npm start      # run Angular dev server
npm run build  # production build
npm run watch  # development watch build
npm test       # run tests
```

### Backend (`/server/package.json`)

```bash
npm run dev    # run Fastify server with tsx watch
npm run start  # start compiled server entry
```

---

## How to use

### 1) Create a request
- Open the app
- Create a new request tab
- Choose the HTTP method
- Enter the target URL
- Add query params and headers as needed

### 2) Choose auth and body
- Select an auth type
- Add a JSON, text, form-urlencoded, or multipart body
- Attach files for multipart requests if needed

### 3) Resolve variables
- Pick an environment
- Use placeholders such as `{{baseUrl}}`, `{{token}}`, or dynamic values
- Review the resolved request preview before sending

### 4) Execute the request
- Send the request through the backend runner
- Inspect the response body, headers, status, duration, and size

### 5) Save and organize
- Save the request
- Place it inside a collection / folder
- Reopen it later through the sidebar tree

### 6) Add assertions
- Define checks such as status or JSON-path expectations
- Re-run the request and inspect pass/fail output

### 7) Run a folder or collection
- Trigger the collection runner
- Optionally stop on failure or add delays between requests
- Review the execution summary

### 8) Share or reuse
- Export a request to cURL
- Import a cURL command back into the app

---

## Variable model

API Workbench supports multiple variable scopes.

### Supported scopes
- request overrides
- active environment
- collection variables
- globals

### Resolution order
1. request overrides
2. active environment
3. active collection variables
4. globals

### Dynamic placeholders
Examples:

```text
{{$timestamp}}
{{$isoDatetime}}
{{$uuid}}
{{$randomInt}}
{{$randomString}}
{{$date}}
```

---

## Assertions

Requests can include lightweight test rules to validate responses.

Examples:
- response status must equal `200`
- response body must contain text
- a response header must exist
- a JSON path must exist
- a JSON path must equal a value

This makes the project useful not only as an API client, but also as a lightweight API testing tool.

---

## Collection runner

The collection runner is designed for practical sequential execution, not full-blown CI orchestration.

Use cases:
- smoke-testing a folder of endpoints
- validating a login → data fetch → update flow
- checking a set of regression-critical endpoints quickly

Current direction:
- sequential execution
- stop-on-failure option
- optional delay between requests
- assertion-aware summaries

---

## cURL support

### Export
Generate a cURL command from the current request for:
- sharing
- debugging
- terminal reproduction
- documentation snippets

### Import
Paste a common cURL command and convert it into an editable request.

Supported common patterns include:
- `-X`
- `-H`
- `--header`
- `-d`
- `--data`
- `--data-raw`

---

## Local data storage

This project is currently **local-first**.

That means saved data lives in the browser via IndexedDB rather than in a shared cloud account.

### Benefits
- very fast startup
- no login required
- simple personal workflow
- cheap to run

### Trade-offs
- not yet team-synced
- not yet multi-user
- browser-local data may not move automatically between machines

---

## Known limitations / current scope

This project is intentionally focused and does **not** aim to replicate every feature of Postman.

Examples of things not positioned as the current core focus:
- team collaboration
- shared cloud sync
- enterprise workspace permissions
- full OpenAPI generation flow
- GraphQL explorer
- WebSocket tooling
- gRPC tooling

The goal is a strong, useful, developer-first API workbench — not bloat.

---

## Why the backend runner exists

A browser-only API client quickly runs into problems when testing third-party APIs:
- CORS restrictions
- preflight behavior
- secret handling concerns
- inconsistent browser request behavior

By sending request definitions to the Fastify runner, the app can execute requests server-side and return a normalized response shape to the Angular UI.

---

## Suggested future enhancements

Potential future directions include:
- OAuth2 improvements
- OpenAPI import
- encrypted secret storage
- desktop packaging
- PWA improvements
- advanced scripting
- scheduled runs
- richer test assertions

---

## Contributing

Contributions, feedback, and ideas are welcome.

If you want to contribute:
1. Fork the repo
2. Create a feature branch
3. Make focused changes
4. Open a pull request with context and screenshots where relevant

Recommended contribution style:
- keep features small and composable
- avoid broad rewrites
- preserve the standalone Angular structure
- keep TypeScript strongly typed
- maintain separation between UI, state, storage, and backend execution

---

## Development notes

This project was built iteratively with AI-assisted development, using a practical “slice-by-slice” approach:
- define the smallest useful feature
- build it end-to-end
- test it manually
- commit it
- move to the next slice

That makes the codebase a good example of how to use AI tools to ship a real developer utility without trying to over-engineer v1.

---

## License

At the time of writing, the repository does **not appear to include a license file**.

If you want others to reuse, modify, or contribute more confidently, consider adding a license such as:
- MIT
- Apache-2.0

Until a license is added, reuse rights are not automatically granted.

---

## Author

Built by **Deon Wolmarans**.

If this project is useful to you, consider starring the repository and sharing feedback or improvement ideas.
