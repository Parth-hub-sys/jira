### 1. Install the backend dependencies

You’ll need Python 3.12, `uv`, a running PostgreSQL server, and Node.js 22.12 or newer with npm.

```powershell
cd D:\jira
uv sync --locked
```

### 2. Start the FastAPI backend

From `D:\jira`, run the command below and keep this terminal open.

```powershell
uv run uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 5
```

- [Swagger API docs](http://127.0.0.1:8000/docs)
- [Backend health check](http://127.0.0.1:8000/health)

### 3. Start the React frontend

Open a **second PowerShell terminal** in `D:\jira`.

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with your work email and password. If Vite prints a different URL, open that URL. The frontend forwards API requests to FastAPI on port `8000` during development. If you change the backend port, set `VITE_API_TARGET=http://127.0.0.1:<port>` in `frontend/.env.local` and restart Vite.

## Use the workspace

1. Go to **Projects** and choose **New project**. Enter a name and an optional description.
2. In **Members → Organization members**, use **Add member** to create a login or add someone with an existing Fluxtech account. Organization owners and admins can do this.
3. In **Members → Project members**, add the people who need access to the project. Members and admins can be assigned tasks.
4. Open the **Board** or **List**, choose **New task**, and select a person in **Assignee**. Open the task to add comments or change its status. The notification bell shows updates.

## Common checks

- **Invalid credentials** — Use the password entered at the provisioning prompt. Check that the backend is using the same database where you created the account.
- **Frontend can’t reach the API** — Open the backend health check first. If you changed ports, check `VITE_API_TARGET`.
- **Sign-in works until a reload** — For local HTTP, check `JWT_REFRESH_COOKIE_SECURE=false` and restart FastAPI.

## Build and test

- **Production frontend** — Run `npm run build` from `frontend`. Serve `frontend/dist` over HTTPS and forward `/api/v1` to FastAPI from the same origin.
- **Backend tests** — Set `JIRA_TEST_DATABASE_URL` to a separate PostgreSQL test database whose user can create schemas, then run `uv run pytest -q` from the project root.

See the [frontend README](frontend/README.md) for more details about workspace features and the frontend source.
