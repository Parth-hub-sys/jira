1. **`users`** — `id`, `email` (unique), `password_hash`, `is_active`, `created_at`, `updated_at`
2. **`organizations`** — `id`, `name`, `slug` (unique), `created_at`
3. **`organization_members`** — `organization_id`, `user_id`, `role`, `joined_at`; unique pair `(organization_id, user_id)`
4. **`projects`** — `id`, `organization_id`, `created_by`, `name`, `key`, `description`, timestamps; unique pair `(organization_id, key)`
5. **`project_members`** — `project_id`, `user_id`, `role`, `joined_at`; unique pair `(project_id, user_id)`
6. **`tasks`** — `id`, `project_id`, `title`, `description`, `status`, `priority`, `reporter_id`, `assignee_id` (nullable), `due_at`, timestamps
7. **`comments`** — `id`, `task_id`, `author_id`, `body`, `created_at`
8. **`labels`** — `id`, `project_id`, `name`; unique pair `(project_id, name)`
9. **`task_labels`** — `task_id`, `label_id`; unique pair `(task_id, label_id)`
10. **`refresh_tokens`** — `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`
11. **`notifications`** — `id`, `user_id`, `type`, `payload`, `read_at`, `created_at`
12. **`activity_logs`** — `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at` i am doing this and in fastapi which thngs need  i am generating table with alembic so tell me which things need to instal thiss