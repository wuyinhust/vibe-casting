# avibe public API v1

Base origin is configurable. HTTPS is required except for loopback development. Read/download tokens use `Authorization: Bearer <token>` and can be revoked from My space.

| Request | Result |
|---|---|
| GET /api/v1/characters?q=…&min_age=…&max_age=…&purpose=commercial&ready=true | items, total, parsed_filters, ranking, suggestions, next_cursor |
| GET /api/v1/characters/{id} | localized profile, looks, package IDs, accessible reference assets |
| GET /api/v1/packages/{id}?purpose=personal | fixed manifest after access checks |
| GET /api/v1/packages/{id}/download?purpose=personal | ZIP matching the manifest |
| GET /api/v1/casting-boards | caller's boards and pinned role assignments |
| GET /api/v1/casting-boards/{id}/export?purpose=personal | cast ZIP, all entries authorized before delivery |

`purpose` is personal, commercial or brand. `ready=true` requires a complete published reference package or an accessible private package. Common errors: AUTH_REQUIRED (401), TOKEN_SCOPE / LICENSE_REQUIRED (403), NOT_FOUND (404), INCOMPLETE_CAST (409), RATE_LIMIT (429).

On no exact matches, `items` is empty and `suggestions` requires explicit changes to the request. Never reinterpret a suggestion as an automatic filter relaxation.
