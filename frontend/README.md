# Fluxtech frontend

Run the React and TypeScript workspace from this directory.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` for the sign-in page. Run the FastAPI app from the repository root on port 8000, then sign in with a provisioned account. Vite proxies requests from `/api` to the backend. Set `VITE_API_TARGET` in a frontend `.env.local` file if the backend listens elsewhere.

The browser keeps the access token in memory and uses an HttpOnly refresh cookie. Reloading the page restores the session through the refresh endpoint. Sign-out revokes the refresh token and clears the cookie. Account settings include **Edit profile** for updating the display name.

Use the header picker to switch organizations. Owners can open **Members → Organization settings → Create organization** to create and switch to a new workspace. In **Organization members**, owners and admins can use **Add member** to link an existing Fluxtech account by email or create a login with a name, email, initial password of at least eight characters, and role. Share initial passwords privately. Use **Manage** to change the role of someone already in the organization. Removing a member also removes their project memberships and task assignments in that organization.

In **Projects**, create a project with a name and an optional description. Fluxtech generates task references automatically. Organization owners, organization admins, and project admins can edit a project’s name and description in **Details**. The details dialog links directly to the project board and member list. Add project members from the organization’s existing members, then grant the **Admin**, **Member**, or **Viewer** role.

Open a task from the board or list to edit its fields, move it through the workflow, or discuss it in **Comments**. Members with write access can post and manage their own comments. Project admins, including organization owners and admins, can also delete other members’ comments. Viewers can read comments and task activity. Both feeds load 30 entries at a time, and activity loads when its tab is opened.

The notification bell shows unread assignments and comments. The browser checks for unread items when the authenticated event stream connects, reconnects, or reports a change. It loads older entries in pages. The inbox’s sound toggle saves the preference in this browser. Playback begins after the first click or key press.

## Source layout

- `src/app/` contains routing, the application shell, and the theme controller.
- `src/features/auth/` contains the sign-in page and its presentation.
- `src/features/workspace/` contains the board, list, overview, task, project, member, and search features, plus the workspace API.
- `src/shared/` contains reusable UI, formatting functions, and the authenticated HTTP client.
- `src/styles/` contains color tokens, shared components, layout, breakpoints, and motion.

Run `npm run build` to type-check and create the production files in `dist`. Serve the frontend and proxy `/api/v1` from the same HTTPS origin. If setting `VITE_API_BASE_URL`, use a URL on that same origin. Keep `JWT_REFRESH_COOKIE_SECURE=true` in production. For local HTTP on a host where the browser rejects Secure cookies, set `JWT_REFRESH_COOKIE_SECURE=false` in the backend `.env` and restart FastAPI.

See the repository’s [design brief](../design.md) for the dashboard layout and project workflow.
