# SAREC Care frontend

The SAREC Care web client is a React 19 single-page application built with Vite, Tailwind CSS, React Router, Axios, Recharts, and Lucide icons. It provides the public landing page, student authentication, role-protected student/admin/resolver dashboards, grievance submission and tracking, private attachment previews, announcements, and administration tools.

For complete architecture, setup, environment variables, security notes, API routes, tests, and deployment steps, see the [project README](../README.md).

## Development

```powershell
npm install
npm run dev
```

Set `VITE_API_URL` in a local `.env` when the API is not running at `http://localhost:5000`. This client does not contain privileged credentials; only public Vite configuration belongs in `VITE_` variables.

## Checks

```powershell
npm test
npm run lint
npm run build
```
