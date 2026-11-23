# Jira API

Copy `.env.example` to `.env` for a new setup and set `DATABASE_URL` and `JWT_SECRET`. Use a generated random JWT secret of at least 32 bytes. To generate one, run `uv run python -c "import secrets; print(secrets.token_urlsafe(48))"`.

```bash
uv sync --locked
uv run alembic upgrade head
uv run python -m scripts.provision_user --email owner@example.com --name "Company Owner" --organization company --organization-name "Company" --role owner
uv run uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/docs` for all 35 endpoints. Send `email` and `password` as JSON to `POST /api/v1/auth/login`, then paste the returned `access_token` into Swagger's **Authorize** dialog or send it as an `Authorization: Bearer` header.

The Fluztech browser sends `X-Auth-Mode: cookie` to login, refresh, and logout on the same origin. Login and refresh return an access token in JSON and set a rotating HttpOnly, SameSite=Strict refresh cookie scoped to the authentication routes. Logout revokes the refresh token and clears the cookie. Access tokens already issued remain valid until expiration. Swagger and API clients can leave the header blank to use the JSON refresh-token flow.

Set both required token lifetimes in `.env` as positive whole numbers in minutes. The example gives an access token 15 minutes and a refresh token 7 days.

```dotenv
JWT_ACCESS_TOKEN_TTL_MINUTES=15
JWT_REFRESH_TOKEN_TTL_MINUTES=10080
```

The next login or refresh reads the current lifetimes from `.env`. The response reports `expires_in` for access tokens and `refresh_expires_in` for refresh tokens, both in minutes. The settings also control the JWT expiry and the database expiry of each newly issued refresh token. Tokens already issued keep their original expiry. Send `refresh_token` as JSON to refresh or log out. Logout revokes the refresh token.

For a `401 Invalid credentials`, verify that you provisioned the email address in the same database that Uvicorn uses and that you entered the password from the provisioning prompt. The command asks for a password of 8 to 1024 characters and stores an Argon2 hash. Login returns the same `401` for an unknown email, a wrong password, or an inactive account.

## Organizations and members

Use the provisioning command in the setup example to create the first organization and owner. From **Members → Organization**, owners can create another organization. Owners and admins can provision a new login through **Add member** by entering a name, email, initial password, and role.

Sign in as an owner or admin and call `GET /api/v1/organizations` to find the organization ID. Then use these routes with the access token.

| Action | Route and body |
|---|---|
| View the organization | `GET /api/v1/organizations/{org_id}` |
| Create an organization as an existing owner | `POST /api/v1/organizations` with `{"name":"Product Studio","slug":"product-studio"}` |
| Rename the organization | `PATCH /api/v1/organizations/{org_id}` with `{"name":"Engineering"}` |
| List members and their user IDs | `GET /api/v1/organizations/{org_id}/members` |
| Add a member by email | `POST /api/v1/organizations/{org_id}/members` with `mode`, `email`, and `role`. Use `"existing"` for an existing account or `"create"` with `name` and `password` for a new account. |
| Add an existing user or change their role | `PUT /api/v1/organizations/{org_id}/members/{user_id}` with `{"role":"member"}`, `{"role":"admin"}`, or `{"role":"owner"}` |
| Remove a member | `DELETE /api/v1/organizations/{org_id}/members/{user_id}` |
| List or create projects | `GET` or `POST /api/v1/organizations/{org_id}/projects`. To create, send `{"name":"Engineering","key":"ENG"}`. |

Owners and organization admins can manage projects across their organization. Only owners can change who holds the owner role, and the organization must retain an owner. Regular members need project membership to access a project. Project viewers can read, project members can work on tasks, and project admins can also manage members and labels. Assignees must be active project members with write access.

Task lists accept `status`, `assignee_id`, `priority`, `label_id`, `q`, `limit`, and `offset`. Tasks start as `pending`, then can move to `in_progress` and `done`. The API also supports moving one step back and retrying the same transition. Task responses include a display key such as `ENG-42` and a UUID for detail routes.

The API returns timestamps in India Standard Time with the `+05:30` offset. Task due dates accept timestamps with an explicit timezone offset.

## Database migrations

Create numbered Alembic migrations with:

```bash
uv run python scripts/alembic_revision.py --autogenerate -m "add tasks"
```

The helper assigns the next filename prefix (`02_`, `03_`, and so on) while
leaving Alembic's unique revision IDs unchanged. Use this helper instead of
`uv run alembic revision` when you want numbered filenames.

Revision `01` creates the base tables. Revision `02` applies the schema changes required by the API to databases that already ran `01`. Alembic records applied revision IDs, so edits to the original revision would be skipped on those databases. Account and organization creation reuse the existing tables.

Revision `02` adds user, task, and project timestamps and tracks the creator of new projects. It adds unique task numbers and a project counter for issue keys such as `ENG-42`. Existing tasks are numbered in UUID order because the original task table had no creation timestamp. It also corrects the notification timestamp column, adds indexes for list queries, and enforces unique label names per project. Existing duplicate label names gain a numeric suffix and keep their IDs and task links.

## Tests

Set `JIRA_TEST_DATABASE_URL` to a dedicated PostgreSQL test database whose user can create schemas, then run `uv run pytest -q`. The integration tests use and remove randomly named schemas in that database.
