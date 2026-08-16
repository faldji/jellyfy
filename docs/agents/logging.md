# Logging

Use `logger` from `src/lib/logger.ts` for diagnosable failures and meaningful state transitions. Skip noise (render churn, routine success, prop dumps).

## API

```ts
import { logger } from '@/lib/logger';

logger.debug|info|warn|error(message, meta?)
```

`debug` and `info` are gated on `__DEV__`. `warn` and `error` always print.

HTTP reads emit `src/api/net.ts` events (`method`, `path`, `ms`, `bytes`, `status`, `deduped`, `cancelled`, `cacheHit`, `retries`, `action`). In `__DEV__` they are buffered (200 events). Inspect with `summarizeNet()` / `netEvents()`. Tag a user flow with `beginNetAction('search')`. Do not log tokens.

Do not add bare `console.*` in new app code. The logger is the one prefix (`[jellyfy]`) and the place to keep secrets out.

## When to log

- Failures and catch blocks that would otherwise vanish (`error` / `warn`)
- Auth / attach / playback transitions that change behavior (`info` or `debug`)
- Fallback paths (SR → Instant Mix, stream reopen) (`warn` / `info`)

Skip: every React render, expected empty states, data the user already sees as a toast unless the log adds process-side detail.

## Message shape

- First arg: short human string. No token, password, or Authorization header.
- Optional second arg: structured `meta` (`{ error, path, eventType }`). Prefer that over string-concatenating errors.
- HTTP debug logs the **path**, not the full URL (query strings can carry `api_key` on streams).
