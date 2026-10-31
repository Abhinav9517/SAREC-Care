# SAREC Care

**Samrat Ashok Rajkiya Engineering College Care**
*Student Grievance & Campus Support Platform*
**Your Campus. Your Voice. Our Responsibility.**

SAREC Care is an independent student-developed project for students and campus teams at Samrat Ashok Rajkiya Engineering College (SAREC), Mirzapur. It is not yet officially adopted, approved, or endorsed by the college. The project identity is `sarec-care`.

A campus operations portal for students to report facilities and IT issues, and for administrators and resolver staff to manage progress through resolution. The application includes private image/video evidence, status and comment timelines, campus announcements, managed categories and locations, resolver provisioning, and a protected user directory.

## Features

- Username and password authentication for students, administrators, and resolvers.
- Public registration creates student accounts only. Passwords are hashed with bcryptjs.
- Active-account checks on every protected API request; resolver accounts must replace their temporary password before accessing the queue.
- Student grievance submission with database-backed category/location choices, collision-safe tracking IDs, and optional private photo/video attachments.
- Student ownership checks on grievance details and attachments.
- Admin and resolver queues with search, filtering, status transition validation, status history, comments, resolution details, and private evidence.
- Admin analytics, announcements and popup acknowledgement, category/location management, resolver provisioning, paginated user directory, and an allowlisted audit-record view.
- Repeatable username/tracking-ID/history backfill tested against an isolated in-memory MongoDB database.
- Responsive React/Vite UI, Tailwind CSS, Recharts, and Lucide icons.

## Architecture

`backend/` contains the Express API, Mongoose models, authentication and upload middleware, controllers/routes, migrations, administrator bootstrap command, and API integration tests. Grievance status and its history are saved together in one document. Audit records are written separately to the same MongoDB database.

`frontend/` contains the Vite React app, role-protected routes, Axios API client, dashboards, private attachment previews, announcements, and admin management screens.

## Requirements and install

- Node.js 20.19+ or 22.12+ (the installed Vite version warns on Node 20.15).
- npm.
- A reachable MongoDB instance: local MongoDB service or MongoDB Atlas. Docker is optional.

From the repository root:

**Windows PowerShell**

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

**Linux/macOS**

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Environment configuration

Copy the examples and edit only local `.env` files. They are ignored by Git.

**Windows PowerShell**

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

**Linux/macOS**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `5000`. |
| `NODE_ENV` | `development` or `production`. |
| `MONGO_URI` | Local MongoDB or Atlas URI. |
| `JWT_SECRET` | At least 32 characters; the example value is development-only. |
| `JWT_EXPIRES_IN` | JWT lifetime, default `1d`. |
| `CLIENT_ORIGIN` | Allowed frontend origin(s), comma-separated if needed. |
| `PASSWORD_RESET_ORIGIN` | Trusted frontend origin used to construct reset links; use HTTPS in production. |
| `SMTP_HOST` | SMTP server hostname. Recovery requests are disabled if mail is not configured. |
| `SMTP_PORT` | SMTP port, commonly 587 for STARTTLS or 465 for implicit TLS. |
| `SMTP_SECURE` | Set `true` for implicit TLS (commonly port 465), otherwise `false`. |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials; both must be set together. |
| `MAIL_FROM` | Configured sender address shown in recovery email. |
| `UPLOAD_DIR` | Private local upload directory; defaults to `backend/private-uploads`. |
| `UPLOAD_MAX_FILE_BYTES` | Per-file upload limit, default 20 MiB. |
| `UPLOAD_MAX_FILES` | Number of files per request, default 5 (maximum 10). |
| `UPLOAD_ALLOWED_TYPES` | Comma-separated MIME allowlist. Signature checks also run on received file data. |

Frontend variables:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL, default `http://localhost:5000`. |
| `VITE_UPLOAD_MAX_FILES` | Client-side count hint; keep aligned with backend. |
| `VITE_UPLOAD_MAX_FILE_BYTES` | Client-side size hint; keep aligned with backend. |

MongoDB local development URI:

```text
MONGO_URI=mongodb://127.0.0.1:27017/campus_grievance
```

Start MongoDB using its Windows service or your operating system service manager. If MongoDB is unavailable, the API intentionally exits without listening. For Atlas, use a database user with limited permissions and restrict network access. Never place a real URI or secret in source files, documentation, or Git.

## Database migration and first setup

Back up existing data. For an existing database, restore a copy to a disposable database and run the migration against that copy first. Set `MONGO_URI` to that database in `backend/.env`; from `backend/`, run:

```powershell
npm run migrate
```

The migration assigns missing usernames from email local-parts, resolves case-insensitive username duplicates deterministically, assigns tracking IDs to existing grievances, repairs duplicate legacy tracking IDs, adds an initial status-history entry only when history is missing, seeds default categories/locations if absent, and creates unique indexes. Existing user IDs, roles, grievance IDs, reporter references, text, and status values are retained. The script is designed to be rerun safely; a test runs it twice against an isolated in-memory MongoDB and verifies there are no duplicated history entries or tracking IDs.

Do not point a migration at production until a restorable backup is available and the same migration has been reviewed on a disposable restored copy. The checked-in migration test does not connect to the configured development database.

### Create the first administrator

Start MongoDB, set the backend environment, and run from `backend/`:

```powershell
npm run bootstrap-admin
```

Enter the administrator name, a unique username, email, and a strong password when prompted. The CLI refuses to add another administrator if one already exists. Do not use public registration or change a browser request to provision privileged users. For a first empty database, run `npm run migrate` once to seed the categories and locations, then bootstrap the administrator.

### Provision resolvers

Sign in as an administrator, open **Administration → Resolvers**, and create a resolver with a unique username, email, and temporary password. Share the temporary password securely. The resolver must change it on first sign-in. Deactivated accounts are rejected both at login and on every later protected API request.

## Run the application

In one terminal:

```powershell
cd backend
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm run dev
```

Open the Vite address shown in the terminal, normally `http://localhost:5173`. For Linux/macOS, the same commands work with `/` path separators. The API listens only after MongoDB connects and can be checked at `GET http://localhost:5000/api/health`.

## Main API

Protected endpoints use `Authorization: Bearer <JWT>`. Error responses have a `success: false` flag and a safe message.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a student with name, username, email, and password. |
| POST | `/api/auth/login` | Public | Login by username; legacy email login is supported during transition. |
| POST | `/api/auth/change-password` | Authenticated | Change the current password; required for provisioned resolvers. |
| POST | `/api/auth/forgot-password` | Public, rate-limited | Request an email recovery link; returns a generic response for existing and unknown addresses. |
| POST | `/api/auth/reset-password` | Public, rate-limited | Consume a single-use 15-minute reset token and set a new password. |
| GET | `/api/catalog/categories` | Authenticated | Active categories for grievance submission. |
| GET | `/api/catalog/locations` | Authenticated | Active campus locations for grievance submission. |
| POST | `/api/grievances` | Student | Create a grievance; multipart fields include `title`, `description`, `category`, `categoryId`, `location`, `locationId`, and repeated `attachments`. |
| GET | `/api/grievances` | Student/Admin/Resolver | Paginated list; students only receive their own reports. Supports status, category, search, page, and limit. Admin/resolver may use `all=true` for the queue (up to 5,000 records). |
| GET | `/api/grievances/:id` | Student/Admin/Resolver | Authorized grievance details, history, comments, attachments, and resolution. |
| PUT | `/api/grievances/:id` | Admin/Resolver | Change status, add a status explanation, and provide structured resolution details. Valid transitions are enforced server-side. |
| POST | `/api/grievances/:id/comments` | Admin/Resolver | Append an official progress or delay comment. |
| POST | `/api/grievances/:id/attachments` | Admin/Resolver | Add private general attachments. |
| POST | `/api/grievances/:id/resolution-evidence` | Admin/Resolver | Add private resolution evidence. |
| GET | `/api/grievances/:id/attachments/:file` | Owner/Admin/Resolver | Authenticated file retrieval; storage names alone do not grant access. |
| GET | `/api/announcements` | Authenticated | Active published notices only, with the current user's acknowledgement state. |
| POST | `/api/announcements/:id/acknowledge` | Authenticated | Acknowledge an active notice. |
| GET/POST/PATCH/DELETE | `/api/admin/categories`, `/api/admin/locations` | Admin | Manage catalog values; deleting referenced values is rejected. |
| GET | `/api/admin/users` | Admin | Paginated, searchable, role/account filtered safe user directory with grievance counts. |
| GET | `/api/admin/users/:id/grievances` | Admin | View reports submitted by a user or handled by a resolver. |
| GET | `/api/admin/users/stats` | Admin | Active/inactive account counts by role. |
| POST/PATCH/DELETE | `/api/admin/announcements` | Admin | Manage notices; use multipart `image` for a private image. |
| POST | `/api/admin/resolvers` | Admin | Provision resolver account with forced password change. |
| PATCH | `/api/admin/resolvers/:id` | Admin | Update resolver name/email. |
| PATCH | `/api/admin/users/:id/active` | Admin | Activate/deactivate accounts. |
| GET | `/api/admin/audit-logs` | Admin | Paginated allowlisted administrative audit records. |

## Roles and privacy

- **Student:** register, submit grievances, and read only their own grievance information and files.
- **Resolver / Maintainer:** view the campus queue, update permitted statuses, append progress comments, and record resolutions/evidence. They cannot manage accounts, categories, locations, or announcements.
- **Administrator:** manage grievances, resolvers, announcements, categories/locations, and read-only user/audit records.

Public registration ignores any supplied role and always creates a student. Safe API projections explicitly omit password hashes and secrets. Inactive accounts cannot use an existing JWT because the backend rechecks account state on protected requests.

## Password recovery

The public **Forgot Password?** page accepts the email already stored on the account. Students, administrators, and resolvers use the same workflow. When SMTP is configured, the API stores only a SHA-256 token hash with a 15-minute expiration and sends the raw, random token only in an email link. A later request replaces the outstanding token. Resetting the password consumes the token atomically, changes the password hash, increments the account JWT version, and requires the user to sign in again. Expiration is checked by the API; recovery does not depend on delayed MongoDB TTL cleanup. No backfill is needed: existing accounts with no token version are treated as version zero until a password or account-security change increments it.

Recovery endpoints apply IP and email-identifier limits, and valid known/unknown addresses receive the same generic response. Reset links use `PASSWORD_RESET_ORIGIN`, never the incoming Host header. In production, configure an HTTPS origin and SMTP credentials through a secret manager. If SMTP settings are absent, recovery returns an unavailable response for all valid requests and does not create reset tokens.

For local development, use a test SMTP service such as Mailpit or a sandbox account from your transactional email provider. Keep its host, credentials, and sender in the ignored `backend/.env`; do not print or commit real secrets. The automated tests replace the SMTP transport with an in-memory mock and never send real mail. If a provider rejects delivery, the API keeps its generic response to avoid account enumeration and writes only a fixed, token-free delivery failure message to the backend log. Check SMTP host/port/TLS settings and provider delivery logs when an expected email does not arrive.

## Upload storage and production

Development uploads are stored under a private local directory outside `frontend/public`; Express does not expose it as static content. The API validates count, size, declared MIME type, and file signatures, assigns random storage names, and retrieves files only after authentication and grievance ownership checks. The local directory must be persisted and protected from other OS users as appropriate.

For production or multiple API instances, configure private object storage or a shared access-controlled storage service, malware scanning, lifecycle/backup policies, and an authenticated retrieval proxy or short-lived signed URLs. Do not make the upload bucket or local directory public. Check the production `UPLOAD_DIR` volume permissions and keep frontend and backend upload limits aligned.

## Tests and builds

Backend integration tests use MongoDB Memory Server and do not use `MONGO_URI`. Password recovery tests replace SMTP with an in-memory mail transport:

```powershell
cd backend
npm test
```

The suite covers student authentication, legacy email transition, resolver provisioning and role access, email recovery for all roles, token hashing/expiry/one-use behavior, session invalidation, rate limiting and SMTP failures, grievance ownership, IDs/history/comments/resolutions, image/video validation and private retrieval, announcements, category/location permissions, user-directory privacy, and migration reruns.

Frontend checks:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

The frontend unit tests use Node's built-in test runner and cover reset-password policy and confirmation validation. Production build output is written to `frontend/dist`.

## Security and deployment notes

- Use HTTPS, a secret manager, restricted MongoDB access, strong rotated JWT secrets, and deployment-specific CORS origins.
- Add infrastructure-appropriate rate limits to protected write/upload routes and monitor storage usage.
- Local development stores JWTs in `localStorage`; this is not complete protection against XSS. A production deployment should review a secure session/token storage design, CSP, and the application’s XSS posture.
- Review dependencies, upload scanning/storage policy, backups, audit retention, and operational logging before deployment. This is a portfolio application and has not been production security certified.

## Troubleshooting

- **`MONGO_URI is not configured`:** create `backend/.env` from the example and set the URI.
- **`ECONNREFUSED 127.0.0.1:27017`:** MongoDB is not running at the configured address; start the local MongoDB service or use a reachable Atlas URI.
- **`EADDRINUSE` on port 5000:** another process already owns the API port. Choose an unused port and point Vite at it. In PowerShell, run `$env:PORT='5001'; npm run dev` from `backend/`, then `$env:VITE_API_URL='http://localhost:5001'; npm run dev` from `frontend/`. On Linux/macOS, run `PORT=5001 npm run dev` and `VITE_API_URL=http://localhost:5001 npm run dev` in their respective directories.
- **Recovery is temporarily unavailable:** configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `MAIL_FROM`, and `PASSWORD_RESET_ORIGIN` in `backend/.env`; set `SMTP_USER` and `SMTP_PASS` together if the provider requires authentication.
- **Recovery email does not arrive:** check the backend’s fixed delivery-failure log entry and your SMTP provider’s delivery/rejection logs. Do not put reset tokens or mail credentials in support tickets.
- **No category or location choices:** run `npm run migrate` against the intended development database to seed defaults.
- **CORS error:** make `CLIENT_ORIGIN` match the frontend origin exactly, including scheme and port.
- **Frontend cannot reach the API:** check that the API is running at `VITE_API_URL`.
- **MongoDB Memory Server download fails:** the test package may need a one-time MongoDB binary download; check network access and rerun `npm test`.
- **Resolver login is blocked:** the resolver must change the administrator-issued temporary password before accessing the queue.

## Screenshots

Screenshots can be added here as the interface is captured.

- `docs/screenshots/student-dashboard.png` — Student dashboard (placeholder)
- `docs/screenshots/admin-dashboard.png` — Administrator dashboard (placeholder)
- `docs/screenshots/resolver-dashboard.png` — Resolver queue (placeholder)

## Production deployment

The frontend is a static Vite build and the backend is a long-running Express service. Configure the frontend and backend as separate projects. Do not commit local `.env` files. The checked-in `backend/.env.example` and `frontend/.env.example` contain development placeholders; production values belong in the hosting dashboards.

### 1. MongoDB Atlas

Create a production database and a dedicated database user with only the permissions the application needs. Put the Atlas connection string in Render as `MONGO_URI`; do not put it in a `VITE_` variable. Configure Atlas network access for the backend host. Review the database name in the connection string and take a restorable backup before any planned migration. The server does not run migrations automatically.

### 2. Brevo transactional email

Enable SMTP for the Brevo account and verify the sender address/domain. Use Brevo's current SMTP host, port, TLS mode, login, and SMTP key values for `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`; set `MAIL_FROM` to the verified sender. Keep the SMTP key only in Render's secret environment settings. Password recovery links use `PASSWORD_RESET_ORIGIN`, which must be the deployed frontend origin using HTTPS. If email is not configured, password recovery is unavailable.

### 3. Render backend

Create a Web Service from the GitHub repository with `backend` as the Root Directory. Use:

| Setting | Value |
| --- | --- |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Set `NODE_ENV=production` and configure the backend variables listed below. Render supplies `PORT`; the server listens on that port and starts listening only after MongoDB connects. Set `CLIENT_ORIGIN` to the exact Vercel frontend origin (scheme and host, no path), and set `PASSWORD_RESET_ORIGIN` to that frontend origin. Do not include `*` or localhost in production origins. If using a custom frontend domain, configure that exact HTTPS origin.

### 4. Vercel frontend

Import the same repository into Vercel and set the Root Directory to `frontend`. The build command is `npm run build`, and the output directory is `dist`. The included `frontend/vercel.json` routes browser paths such as `/reset-password` back to the SPA entry point. Set `VITE_API_URL` to the Render service origin, for example `https://your-api.example.com` (no `/api` suffix; the client includes `/api/...`). Redeploy after changing this variable because Vite embeds it in the static bundle. `VITE_` values are public; never put credentials or tokens there.

### Environment variables by dashboard

**Render backend service:**

| Variable | Required / purpose |
| --- | --- |
| `NODE_ENV` | Set to `production`. |
| `PORT` | Supplied by Render; do not hardcode a port in the service configuration. |
| `MONGO_URI` | Production Atlas connection string. |
| `JWT_SECRET` | Cryptographically random secret of at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`; store only in Render. |
| `JWT_EXPIRES_IN` | Optional; defaults to `1d`. |
| `CLIENT_ORIGIN` | Exact HTTPS Vercel/custom frontend origin; comma-separated exact origins are supported. |
| `PASSWORD_RESET_ORIGIN` | HTTPS frontend origin used to build reset links. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Brevo SMTP endpoint and TLS settings. |
| `SMTP_USER`, `SMTP_PASS` | Brevo SMTP login and SMTP key; configure both together, only in Render. |
| `MAIL_FROM` | Verified sender address. |
| `UPLOAD_DIR` | Optional path to persistent storage mounted to the backend service; set this to the mount path when using a persistent disk. |
| `UPLOAD_MAX_FILE_BYTES`, `UPLOAD_MAX_FILES`, `UPLOAD_ALLOWED_TYPES` | Optional server-side attachment limits and MIME allowlist; current defaults are 20 MiB, 5 files, and JPEG/PNG/WebP/MP4/WebM. |

`ADMIN_BOOTSTRAP_PASSWORD` is an optional local CLI override, not a production service setting. Do not provision an administrator through a hardcoded environment password. Run the interactive bootstrap command only against the intended database in a controlled administrative session after deployment, or use a separately reviewed secure provisioning process. Run `npm run migrate` only after a backup and an explicit review on a restored copy; it changes records and indexes.

**Vercel frontend project:**

| Variable | Required / purpose |
| --- | --- |
| `VITE_API_URL` | Required deployed backend origin. This is public configuration, not a secret. |
| `VITE_UPLOAD_MAX_FILES` | Optional UI hint; align with the backend limit. |
| `VITE_UPLOAD_MAX_FILE_BYTES` | Optional UI hint; align with the backend limit. |

Never configure `MONGO_URI`, `JWT_SECRET`, SMTP credentials, bootstrap passwords, or other secrets in Vercel frontend variables, especially variables prefixed with `VITE_`.

### Upload persistence and security limits

Attachments and announcement images are written to local disk by Multer under `UPLOAD_DIR` (default `backend/private-uploads`) and served only through authenticated routes. MongoDB stores their metadata, not the file contents. A normal ephemeral web-service filesystem can lose files during restarts, redeploys, or instance replacement; multiple instances also do not share local files. Use a persistent disk mounted at `UPLOAD_DIR` for a single backend instance, with backups and access controls, or move storage to a private object-storage service with authenticated retrieval and lifecycle/backup policies. No storage migration is implemented here; existing local uploads must be copied and their metadata/path handled deliberately before changing storage. Never expose the upload directory or bucket publicly.

Use HTTPS on both services, least-privilege Atlas credentials, restricted database network access, and a random production JWT secret. Review localStorage-based JWT storage, XSS protections, rate limits on uploads/writes, upload malware scanning, backups, retention, and monitoring before serving sensitive campus reports. The project does not automatically run a destructive migration or create a production administrator.
