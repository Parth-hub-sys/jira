# Fluxtech workspace design

## What works in the Rapport demo

I reviewed the overview at desktop and mobile widths and tried its chart range and search controls. The design feels spacious even with several panels because the page title and headline numbers are easy to scan, the panels have a clear order, and secondary actions sit in small controls. [Rapport overview demo](https://demo.codeandchill.store/rapport/#/overview)

| What I observed | How it fits this workspace |
| --- | --- |
| A warm gradient behind mostly translucent, rounded panels. The main cards have a faint bright border and a broad, soft shadow. | Use a cream canvas with peach, honey, and sage light. Use olive-charcoal in dark mode. Let jade highlight project completion. |
| Headline numbers sit beside the page title. A wide revenue chart and a taller group of featured deals anchor the page. | Put three small counts near the project title. Pair a wide **Work by status** panel with a compact **Due soon** list. |
| The same card shell holds a chart, a progress ring, a ranked list, or individual deal cards. The inner deal cards carry the title, date, status, and avatars. | Use a shared panel shell, then give smaller task cards a stable reading order with task key, title, priority, due date, and assignee. |
| The overview reveals its panels and featured cards in sequence. During entry, the chart draws in and the numbers build toward their final values. Chart range buttons update the chart in place. | Use a short entrance, fill status bars when results arrive, and animate the selected filter. Show the real task counts as soon as the data is available. |
| A floating icon dock keeps frequent actions close. On mobile, it moves to the bottom. The main cards stack, and the chart shows fewer axis labels. The Search control opens an overlay. | Keep a compact rail on desktop and a labeled bottom dock on mobile. Search tasks in the selected project from the same keyboard shortcut on either layout. |

## Visual design

Use warm glass panels with a fine edge and restrained blur for the shell and board lanes. Keep task cards opaque and saturated so their titles and metadata read clearly at a glance.

| Element | Light | Dark |
| --- | --- | --- |
| Canvas | Warm cream | Olive-charcoal |
| Background washes | Peach, honey, sage | Clay and muted forest |
| Glass panels | Translucent ivory | Translucent smoky olive |
| Pending cards | Honey with deep brown text | Honey with deep brown text |
| In progress cards | Jade with ivory text | Jade with ivory text |
| Done cards | Charcoal with ivory text | Ivory with charcoal text |
| Attention | Burnt clay | Light clay |

- **Canvas** Use overlapping radial washes over `--canvas`. The appearance menu lets users pick Light, Dark, or Match system on the sign-in page and in the workspace.
- **Type** Use DM Sans with a system fallback. Set page titles to 36/40 px on desktop and 28/34 px on mobile. Use 18/24 px for panel headers, 14/20 px for body text, and 13/18 px for secondary text. Give metrics tabular numbers.
- **Spacing** Use a 4 px spacing unit. Use 24 px desktop panel gaps, 16 px on mobile, and 20 px padding inside major panels. Use radii of 22 px for panels, 14 px for task cards, 10 px for inputs, and fully rounded status pills.
- **Status and priority** Pair stage colors with explicit labels. Use clay to draw attention to urgent and overdue work.
- **Icons** Use one outline icon family. Pair unfamiliar actions with a visible text label. Give icon-only actions a tooltip and an accessible name.

## Workspace layout

The top bar holds the organization picker, the current project, search, notifications, and the profile menu. Keep **New task** visible for users with permission to create tasks. The rail links to **Overview**, **Projects**, and the selected project's **Board** and **List**. Organization owners and admins can manage the organization from **Members**. Project admins can manage project membership from the project view.

### Desktop overview

Use a 12-column grid inside a content area capped at 1,480 px. The main chart spans seven columns, and the due list spans five. When there is no active project, show the project picker and a link to Projects.

```text
Organization ▾     Project ▾        Search        New task   Notifications   Profile
Rail    Project overview                             [All tasks | Assigned to me]
        Open                 In progress                  Done

        Work by status                                   Due soon
        Pending       ███████  12                        ENG-42  Invite workflow
        In progress   ████      6                        Tomorrow          High
        Done          █████     8                        …
        ────────────────────────────────────────────────────────────────────────
        Completion                                      Assigned to me
        Ring + completed / total                         Task rows with status
```

- **Counts** Open is Pending plus In progress. Done is the number of completed tasks. Apply the same project and assignee scope to the counts and status chart.
- **Due soon** Show up to five open tasks with due dates in the next seven days. Sort by due date and label overdue tasks explicitly if shown in a separate overdue row. Use India Standard Time for date grouping.
- **Completion** Show `done / total` as a ring and a text label. Show an empty message when the project has no tasks. For the first version, render current status data from the task list. A historical completion trend needs a scoped history or reporting API.
- **Task row** Use the full task key, a one- or two-line title, a text status pill or priority, and a date or assignee where relevant. Clicking the row opens the task detail route.

### Responsive behavior

| Width | Layout |
| --- | --- |
| 1,200 px and up | Full rail, 12-column overview, three Kanban lanes in view |
| 768–1,199 px | Compact rail, two overview columns where they fit, task detail as a side panel |
| Under 768 px | Single-column overview, compact header, labeled bottom dock, full-screen task details. Keep bottom padding for the dock and mobile safe area. |

For a narrow board, use a horizontal scrolling area with a visible lane count and a status selector. Keep the rest of the page within the viewport. The list view should show rows or stacked cards with the same filters. Check the layout at 390 px and with long company names and task titles.

## Core screens and interactions

| Screen | What to build |
| --- | --- |
| Sign in | A dedicated page with work email, password visibility, sign-in feedback, and a board illustration. The board opens after sign-in. |
| Projects | Search visible projects by name or key on the page. Each card shows project name, key, description, and links to **Board** and **List**. Owners and organization admins see **New project**. |
| Board and List | Share the project selector and task filters. Board lanes are Pending, In progress, and Done. List rows show key, title, status, priority, due date, and assignee. Keep filters in the URL so refresh and navigation preserve the view. |
| Task detail | Route to the task UUID and display its key, title, description, assignee, due date, labels, comments, and activity. Open it as a right-side panel from the desktop board and as a full page on mobile. Return focus to the invoking card when the panel closes. |
| Members | Use a restrained table with name, email, role, and joined date. Show each person's organization role and manage project membership in the project view. Display server errors near the relevant action. |
| Notifications | Use the top-bar bell to open a list with an unread state. Link task notices to the task detail and mark notices read through the API. |

### Cards and movement

The board card has a small key, a title, one line of optional labels, and a footer with the priority and assignee. Use the card itself to open details and a separate menu for actions. Keep the assignee name available to keyboard and screen-reader users when displaying initials.

Dragging a card moves it between allowed statuses. **Move to** in the card menu exposes the same actions for keyboard and touch users. The current API allows Pending → In progress, In progress → Pending or Done, and Done → In progress. A move changes status. The current API does not save a custom order within a lane. Show a saving state and update counts after success. On failure, return the card to its previous lane and show the server message. [Task workflow implementation](app/services/tasks.py)

### Motion

| Interaction | Spec |
| --- | --- |
| Dashboard entry | Fade and move up 6 px in 180–220 ms. Stagger four visible panels by about 30 ms each. Keep text readable during the transition. |
| Interactive card hover | Lift by 2 px in 140 ms and strengthen the shadow. Provide an equivalent visible focus state. |
| Chart filter | Move the selected pill in 160 ms and grow bars to their new values in up to 300 ms. Keep the numeric labels legible throughout. |
| Search, dialogs, and task details | Fade the overlay and move the panel a short distance in 160–220 ms. Use Escape to dismiss and restore focus. |
| Board update | Lift a solid card preview and use the destination lane’s color. Show an outlined landing slot in a valid lane, then settle the card and update the lane count after the move succeeds. |

Use transform and opacity for decorative motion. Respect `prefers-reduced-motion` by replacing slide, stagger, and chart-fill effects with immediate state changes. Aim for 44 px touch targets and at least 4.5:1 contrast for normal text. Show counts and labels alongside chart graphics. [W3C motion guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Connect the UI to FastAPI

Every path below uses the `/api/v1` prefix.

| UI | Existing endpoints and behavior |
| --- | --- |
| Login and session | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /users/me`. Pass the Bearer access token on protected requests. Coordinate concurrent refreshes because a refresh token is replaced on use. |
| Organization picker and members | `GET /organizations`, `GET /organizations/{org_id}/members`, `PUT /organizations/{org_id}/members/{user_id}`, and `DELETE` on the same member route. Use the provisioning command for a new user account. |
| Project picker and settings | `GET` and `POST /organizations/{org_id}/projects`, `GET` and `PATCH /projects/{project_id}`, and the project membership routes under `/projects/{project_id}/members`. |
| Overview, Board, and List | `GET /projects/{project_id}/tasks` with `status`, `assignee_id`, `priority`, `label_id`, `q`, `limit`, and `offset`. Fetch all pages within the selected scope before showing exact totals. |
| Task changes | `POST /projects/{project_id}/tasks`, `GET` and `PATCH /tasks/{task_id}`, and `POST /tasks/{task_id}/transitions` with a body like `{"status":"in_progress"}`. |
| Task panels | `/tasks/{task_id}/comments`, `GET /tasks/{task_id}/activity`, `GET /projects/{project_id}/labels`, and `PUT /tasks/{task_id}/labels`. Activity is scoped to a task. |
| Notifications | `GET /notifications` and `PATCH /notifications/{notification_id}`. |

Use the signed-in user's ID for **Assigned to me**. Make search project-scoped using the task list's `q` parameter. The existing API controls access by organization and project. If it returns `403`, show a permission message and keep the current page intact.

## Implementation order

1. Build the shell, warm-glass theme tokens, navigation, login, and organization and project pickers.
2. Build reusable panels, task rows, filter controls, and empty, loading, and error states. Connect the overview and list to the task API.
3. Add Board and task details with permitted moves, assignment, comments, and labels. Then add member management and notifications.
4. Add motion and verify the dashboard at desktop and mobile sizes, with keyboard-only navigation and reduced motion. Confirm that filtering keeps counts consistent and that failed moves restore the original card position.
