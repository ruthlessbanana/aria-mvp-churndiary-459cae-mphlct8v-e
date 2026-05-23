# ARIA MVP codegen — template rules

## Repository

- Base: **ariaagi/aria-template-live-product** @ **master** (deploy ref `master`).
- **Additive only:** extend under `codeConstraints.suggestedFeatureRoot` from **./mvp-build-spec.json**.
- **Do not edit** any path listed in `codeConstraints.doNotModifyPaths`.

## Dependencies (`package.json`) — additive only

Treat `package.json` as **template-owned**. The template's helpers, shells, and migrations import from these packages, so removing **any** of them breaks the build or runtime even if your feature code does not import them directly.

Rules — non-negotiable (audited by `audit-package`):

- **NEVER remove** an existing entry from `dependencies` or `devDependencies`. Even if you do not use it, other template files do.
- **NEVER replace** a pinned version (e.g. `^4.3.6`) with a wildcard (`*`, `latest`, `>=x`). Keep the template's exact range.
- **You MAY add** new dependencies your feature genuinely needs. Use a pinned semver range (`^x.y.z` / `~x.y.z`), never `*` / `latest`.
- **Always-required (load-bearing) deps — must remain in `package.json` exactly as the template ships them:**
  - Build / runtime: `next`, `react`, `react-dom`, `tailwindcss`
  - Database: `@neondatabase/serverless`, `pg`
  - Auth: `better-auth`
  - Billing: `stripe` (server SDK; client SDK like `@stripe/stripe-js` is **only** required if you actually import it in client code — do not pre-emptively add it)
  - BYOK / email helpers the template ships: `@anthropic-ai/sdk`, `openai`, `resend`
  - Validation: `zod`
- **Lock files:** if you add a dep, also update `package-lock.json` (`npm install` does this automatically). Do not commit a manually-edited lockfile.

If a build / lint error tells you an import is missing, **prefer rewriting your code to use what the template already provides** before adding a new dep.

## Data access

- Use **`getDbPool()`** from `@/lib/db` (see template `src/lib/db.ts`).
- Respect Better Auth + billing tables already in the DB; new product tables use **new** snake_case plural names.
- **Reserved tables (do not create):** `account`, `app_events`, `rate_limits`, `session`, `user`, `user_secrets`, `verification`. The template owns these.
- **New migrations start at `db/migrations/0005_*.sql` and go up**. Template owns **0001-0004** — never create, rename, overwrite, or duplicate those numbers; doing so will be rejected by `audit-migration-content` and will collide with the baseline migrations the build worker already applied to the Neon database before Claude ran.

### Required column shape for every product table (audited)

Every `CREATE TABLE` in `db/migrations/0005+_*.sql` MUST contain these columns. Audits `audit-migration-content` and `audit-multitenancy` reject the build (and the repair loop will bounce you back) if any are missing:

- `id text primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `user_id text not null references "user"("id") on delete cascade` *(when the spec is multi-tenant — i.e. `capabilities.multiTenancy.perUserData` is `true` or unset; this is the default)*
- A supporting index on `user_id` for read performance: `create index if not exists <table>_user_id_idx on "<table>"(user_id);`

Carve-outs:

- **Share-token lookup tables** (e.g. `kit_shares`, `<resource>_shares`, `share_tokens`) are exempt from `user_id` when `capabilities.publicShare` is declared — they're token-keyed and scoped to a user transitively via the parent table's FK.

### Worked example — the canonical compliant migration

Copy this shape verbatim for new tables, only changing the table/column names:

```sql
-- db/migrations/0005_kits.sql
create table if not exists "kits" (
  id text primary key default gen_random_uuid(),
  user_id text not null references "user"("id") on delete cascade,
  title text not null,
  body text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kits_user_id_idx on "kits"(user_id);
create index if not exists kits_status_idx on "kits"(status);
```

If your feature genuinely needs a second migration, increment the migration number from `0005` upward. Never reuse `0001-0004`.

## Postgres SQL gotchas (audited by `audit-sql_dialect`)

Postgres aggregate functions (`SUM`, `AVG`) require a **numeric** argument. They reject boolean expressions and the request will throw `function sum(boolean) does not exist` at runtime — which renders the template's `error.tsx` "Something went wrong" page instead of your component. The audit rejects these patterns; use the documented replacements:

```sql
-- ❌ WRONG — boolean argument to SUM/AVG (rejected by audit-sql_dialect)
SUM(adapted_body IS NOT NULL)
SUM(status = 'published')
SUM(NOT archived)
SUM(true)
AVG(score > 0)

-- ✅ CORRECT — conditional COUNT (preferred, idiomatic Postgres)
COUNT(*) FILTER (WHERE adapted_body IS NOT NULL)::int
COUNT(*) FILTER (WHERE status = 'published')::int
COUNT(*) FILTER (WHERE NOT archived)::int

-- ✅ CORRECT — CASE WHEN when you specifically need SUM/AVG
SUM(CASE WHEN adapted_body IS NOT NULL THEN 1 ELSE 0 END)::int
AVG(CASE WHEN score > 0 THEN 1.0 ELSE 0.0 END)
```

Rule of thumb: if the inner expression of `SUM(...)` / `AVG(...)` is a comparison, an `IS [NOT] NULL` check, a `NOT`, or a boolean literal — rewrite it with `COUNT(*) FILTER (WHERE ...)` or `CASE WHEN ... THEN 1 ELSE 0 END`. The audit catches the entire family.

## API routes (use these helpers — do not reimplement)

Every route handler under `src/app/api/**` you create MUST follow this pattern:

```ts
import { okJson, errJson } from "@/lib/server/api/json-response";
import { requireSession } from "@/lib/server/api/require-session";
import { parseJsonBody } from "@/lib/server/api/parse-body";
import { withApiErrorHandling } from "@/lib/server/api/with-api-error-handling";
import { z } from "zod";

const bodySchema = z.object({ title: z.string().min(1).max(120) });

export const POST = withApiErrorHandling(async (req) => {
  const { user } = await requireSession();
  const body = await parseJsonBody(req, bodySchema);
  // ... do work, scoped by user.id
  return okJson({ id: "..." });
});
```

Rules:
- **Auth gate:** every route that touches per-user data MUST start with `await requireSession()`. The `audit-auth-gating` step rejects builds that don't.
- **Input validation:** every POST/PATCH/PUT MUST use `parseJsonBody(req, zodSchema)`. The `audit-input-validation` step rejects builds that don't.
- **Envelope:** return `okJson(data)` / `errJson(code, status, detail?)` — never raw `NextResponse.json(...)`. The wire shape is `{ ok: true, data: <payload> }` for success and `{ ok: false, error, detail? }` for failure. **Client code MUST read the payload through `.data.<field>`** (see "Reading API responses on the client" below) — typing a fetch result as `{ ok: boolean; <field>?: ... }` and reading `.<field>` directly is a contract violation that the `audit-client_envelope` step rejects.
- **Logging:** `logger.info|warn|error` from `@/lib/server/logger` (no `console.log` in committed code).
- Edge `middleware.ts` already enforces a 60 req/min IP rate limit on `/api/**` (excluding `/api/auth/*` and `/api/webhooks/*`). For per-user limits on expensive ops (LLM calls, exports), use the `rate_limits` table.

## Reading API responses on the client (envelope contract)

Server routes always reply with the envelope `{ ok: boolean; data?: <payload>; error?: string; detail?: string }`. The payload lives **inside `data`**, not at the top level. Failing to read the wrapper is the single most common bug Claude ships in client code — the request succeeds, the toast says "Failed to ...", and nothing navigates. Always type and read like this:

```ts
const res = await fetch("/api/kits", { method: "POST", body: JSON.stringify(input) });
const json = (await res.json()) as {
  ok: boolean;
  data?: { kit?: { id: string; title: string } };
  error?: string;
  detail?: string;
};
if (!res.ok || !json.ok || !json.data?.kit) {
  toast.error(json.detail ?? json.error ?? "Failed to create kit");
  return null;
}
const kit = json.data.kit; // ✅ correct
```

**Anti-pattern (rejected by `audit-client_envelope`):**

```ts
const json = (await res.json()) as { ok: boolean; kit?: { id: string }; error?: string };
const kitId = json.kit?.id; // ❌ undefined — the payload is at json.data.kit, not json.kit
```

This rule applies to every `fetch("/api/...")` call site you write across `src/features/**` and `src/app/(app)/**`.

## Billing / Stripe

- Do not rewrite core billing plumbing; integrate with existing subscription/billing shell when needed.
- If **`codegenPolicies.unifiedSubscriptionGating`** is true (or the spec describes paid/free tiers), apply the **same** subscription/paywall checks on **every** route that shows gated content — Home and detail pages must agree.
- Server-side, gated handlers MUST call `await requireActiveSubscription(userId, "<routePath>")` from `@/lib/server/api/require-subscription` before doing the gated work, where `<routePath>` is a **string literal** matching the route's entry in `capabilities.paywallGating.gatedRoutes` (e.g. `"/api/boards"`, `"/home/boards/new"`). The route argument is what tells the runtime which routes to enforce — without it, the helper falls back to the legacy global flag and **does not** gate mixed (free+paid) apps. The `audit-paywall` step rejects builds where a gated route does not call this helper with a string-literal route argument.

## Pricing copy (canonical)

- If **`./mvp-build-spec.json`** includes **`ariaBuildPricing`** (merged from the ARIA Build UI at deploy time), treat it as the **only source of truth** for **numeric prices** (amounts, currency, tier names) in JSX, paywalls, upgrade CTAs, and marketing blurbs you add.
- At runtime, **`getBuildConfig()`** / **`aria-build.config.json`** must stay consistent — prefer reading config helpers for displayed plan labels when the template exposes them.
- **Do not** pull dollar amounts from **`capabilityBullets`**, **`primaryUserFlow`**, or **`screens[].purpose`** when those conflict with **`ariaBuildPricing`** — those fields may predate the user's chosen plans.

## Responsive UI

- **`codegenPolicies.responsiveMobileFirst`** or product screens: use mobile-first Tailwind (`sm:` / `md:`), stack columns on small screens, avoid clipped buttons (`flex-wrap`, `min-w-0`, scroll containers in cards).

## External AI / API keys (BYOK — use the helpers, do not roll your own)

If **`codegenPolicies.externalAiUserSecrets`** is true — or the spec calls OpenAI / Anthropic / Firecrawl / Serper / Resend / etc. APIs per user — use the BYOK foundation the template ships:

- **Storage:** the `user_secrets` table (template migration 0004) is already created. Do NOT create your own secrets table.
- **Server access:** `await getUserSecret(userId, providerKey)` from `@/lib/server/secrets/user-secret-store`. Returns `null` when not configured — surface a friendly "configure your API key in Settings → API Keys" message rather than 500.
- **Settings UI:** add an "API Keys" entry to `src/config/settings-tabs.config.ts` (`{ slug: "api-keys", label: "API Keys" }`) and create `src/app/(app)/settings/api-keys/page.tsx` with a form per provider that POSTs to a route calling `setUserSecret(userId, providerKey, plaintext)`.
- **Provider slugs (lowercase):** `"openai"`, `"anthropic"`, `"firecrawl"`, `"serper"`, `"resend"`, `"github"`, etc. One slug per provider per user.
- **Forbidden:** reading per-user provider keys via `process.env.<PROVIDER>_API_KEY` in feature code. The `audit-byok` step rejects builds that do this for providers the spec lists.

## Email

- If the spec needs to send email (digests, notifications, share invites): `await sendEmail({ to, subject, html })` from `@/lib/server/email/send-email`. The helper wraps Resend and falls back to a no-op log when `RESEND_API_KEY` is missing — your code does not need to branch on it.
- Set `RESEND_FROM_EMAIL` env on Vercel for production sends; otherwise the helper uses Resend's onboarding sender.

## Sidebar navigation (extension point)

- For top-level user-facing sections (e.g. "Workouts", "Recipes"), write `src/config/sidebar-nav.config.ts` with `SidebarNavItem[]`. Items render between Home and Billing in the sidebar. Use `iconName` from the lucide-icon allowlist in that file (or omit to use the default folder icon).

## Settings tabs (extension point)

- For Settings sub-pages (API Keys, Notifications, Integrations, Team): write `src/config/settings-tabs.config.ts` with `SettingsTab[]`, each a `{ slug, label }` pair. The shell renders the tab strip and links to `/settings/<slug>`. You create `src/app/(app)/settings/<slug>/page.tsx` for each. Profile is built-in; do not duplicate.

## UX boundaries

- The template ships `(app)/{loading,error,not-found}.tsx` and root `global-error.tsx`. Override per feature segment ONLY when you have a feature-specific skeleton or empty/error message that improves on the default. Do NOT modify the segment-level files.

## Capabilities (read your spec's `capabilities` block — implement each present capability per these rules)

For every capability declared in the spec, follow the implementation contract below. Each is audited after Claude finishes — if your code doesn't match the contract, the build is rejected and you'll get a fix prompt:

- **`externalAi`** (`primaryProvider`, `byok`):
  - Add `{ slug: "api-keys", label: "API Keys" }` to `src/config/settings-tabs.config.ts`.
  - Create `src/app/(app)/settings/api-keys/page.tsx` with a form per provider (one input per slug). Form POSTs to a server action / route handler that calls `setUserSecret(userId, providerSlug, value)`.
  - In your AI route(s), read the key via `const apiKey = await getUserSecret(userId, "openai")` (etc.). On null, return `errJson("missing_api_key", 400, "Configure your OpenAI key in Settings → API Keys")`.
  - NEVER read `process.env.OPENAI_API_KEY` (or similar) in feature code — only the deploy-env fallback is allowed and even that requires explicit codegenPolicies.externalAiUserSecrets=false.

- **`paywallGating`** (`gatedRoutes`):
  - At the top of every gated **API route** handler: `const { user } = await requireSession(); await requireActiveSubscription(user.id, "/api/<route>");`. The second argument is a string literal that **must match** the route's entry in `capabilities.paywallGating.gatedRoutes` exactly (with the leading slash). This is mandatory — without the route argument, mixed (free+paid) apps will not enforce the paywall at all because the runtime falls back to the legacy global flag.
  - For Server Components / pages: `if (!(await canUserRunProtectedAction(user.id, "/home/<route>"))) { return <PaywallCard /> }` — same rule, pass the route literal that matches the spec entry.
  - Quick sanity check: search your file for `requireActiveSubscription(` and `canUserRunProtectedAction(` — every call site MUST have a second argument that is a string literal beginning with `/`.
  - **Critical (post-Vercel acceptance):** every route in `capabilities.paywallGating.gatedRoutes` must **render successfully** for users **without** an active subscription — show paywall / preview / upgrade UI only. It must **never** throw during render (no uncaught exceptions, no reading undefined premium-only props) such that `(app)/error.tsx` appears. ARIA's tester navigates each gated route after signup and fails the build if the error boundary text is visible.

- **`multiTenancy.perUserData`** (default true):
  - Every product table created via your migrations MUST have `user_id text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE` and an index on `user_id`.
  - Every read query MUST filter by the authenticated user: `WHERE user_id = $1` (or use a helper that does it).
  - Every write must set `user_id` from `session.user.id`, never trust client-supplied user_id.

- **`publicShare`** (`publicShareRoutes`):
  - Routes live under `src/app/share/` (a sibling to `(app)`, NOT inside the auth-gated layout).
  - DO NOT call `requireSession()` in share routes — they're public. Read by the share token in the URL path.
  - Add a server-side check that the share token is valid and not expired (when `expirable`).
  - Generate share URLs via `getRequestOrigin()` from `@/lib/server/auth/app-origin` — never hardcode `vercel.app` / `localhost`.

- **`backgroundJobs`** (`schedules`):
  - Add a Vercel cron config in `vercel.json` with one entry per schedule pointing to a route under `src/app/api/cron/<job>/route.ts`.
  - Cron handlers MUST verify the request comes from Vercel cron (check `Authorization: Bearer ${process.env.CRON_SECRET}` env), not a public POST.

- **`emailNotifications`** (`triggers`):
  - Send via `await sendEmail({ to, subject, html })` from `@/lib/server/email/send-email`. Don't import Resend directly.
  - Insert an `app_events` row with `event_type = "<trigger_slug>_email_sent"` after each successful send for analytics.

- **`fileUploads`** (`storageProvider`, `acceptedMimeTypes`):
  - For `vercel_blob`: use `@vercel/blob` (already in template's `package.json` family — install if missing). Server route returns a signed PUT URL; client uploads directly.
  - Validate MIME type against `acceptedMimeTypes` server-side (don't trust the client).
  - Enforce `maxSizeMb` via `Content-Length` check before generating the signed URL.

- **`realtime`** (`transport`):
  - For `polling`: use `useSWR` or `react-query` with a 3–10s `refreshInterval`. Simplest, no infra.
  - For `sse`: a `Response` with `Content-Type: text/event-stream` from a route handler.
  - For `pusher`: use `pusher-js` on the client with `process.env.NEXT_PUBLIC_PUSHER_KEY` and `NEXT_PUBLIC_PUSHER_CLUSTER`; server uses `pusher` npm with `PUSHER_APP_ID`, `PUSHER_APP_KEY`, `PUSHER_APP_SECRET`, `PUSHER_CLUSTER`. Implement `POST /pusher/auth` (and user-auth if needed) with the server secret — never expose the secret to the client.
  - For `ably`: BYOK via `getUserSecret` when the spec requires per-user Ably keys.

- **`dataExport`** (`formats`):
  - One server route per format: `/api/export/<resource>?format=csv`.
  - Streams the data as the response body with appropriate `Content-Disposition: attachment`.
  - Add an "Export" button to the relevant list page header.

## E2E test contract — write code that matches the spec's structured declarations

After Vercel deploy ARIA runs a Playwright acceptance suite that drives the
app **directly from the spec's structured declarations** — `forms[]`,
`deleteFlows[]`, `settingsForms[]`, `scheduledActions[]`, `transitions[]`,
and `integrationTouchpoints[]`. Your job is to render the UI and APIs so the
spec's declarations are literally true: same field names, same submit button
names, same DB columns, same status values. The runner does **not** guess; it
only does what the spec says. Following these rules keeps the build green:

Additionally, the suite **navigates every** `capabilities.paywallGating.gatedRoutes` **entry after signup** and expects a normal paywall/preview — **not** `(app)/error.tsx` — for users without a subscription.

### Create-form pages (`src/app/(app)/<resource>/new/page.tsx`)

1. **Hold form state in a single `useState`** with literal default values:

   ```tsx
   const [form, setForm] = useState({ title: "", body: "", channelType: "linkedin" });
   ```

   The state keys are the canonical field names. They become the JSON keys the
   form POSTs and they map 1:1 to your API's zod schema field names. Don't use
   per-field `useState` — the planner extracts fields by reading this object.

2. **Bind every control to that state** with `value={form.<key>}`:

   ```tsx
   <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
   ```

   The planner reads `value={form.title}` to know which control fills which key.

3. **Render a sibling `<label>`** immediately before each control with the
   visible field name (asterisk for required is fine):

   ```tsx
   <label className="text-sm font-medium">Title *</label>
   <input required value={form.title} ... />
   ```

   The runner locates fields by sibling-label first when no `name=` attribute
   is present.

4. **Mark required fields with `required`** on the input/textarea/select
   itself. The runner only fills required fields by default.

5. **Submit button must be `<button type="submit">`** with a stable visible
   label. A loading-state ternary is fine — the runner picks the truthy branch:

   ```tsx
   <button type="submit" disabled={loading}>
     {loading ? "Saving…" : "Import Post"}
   </button>
   ```

6. **`onSubmit` calls `fetch("/api/<resource>", { method: "POST", body: JSON.stringify(form) })`**
   with a literal URL prefix. The planner pulls the endpoint string verbatim.

### List pages (`src/app/(app)/<resource>/page.tsx`)

1. **Filter input has a static placeholder** containing one of `filter`,
   `search`, `query`. The runner types the created row's title into it:

   ```tsx
   <input placeholder="Filter posts…" value={filter} onChange={(e) => setFilter(e.target.value)} />
   ```

2. **Each row links to its detail page** via a literal-prefix template:

   ```tsx
   <Link href={\`/home/posts/\${post.id}\`}>
     <span>{post.title}</span>
   </Link>
   ```

   The first `{<obj>.<column>}` accessor inside the link is treated as the
   row's title column — make sure it matches the DB column the create form
   writes (e.g. `title` ↔ `posts.title`).

### API routes (`src/app/api/<resource>/route.ts`)

1. The route validates input via `parseJsonBody(req, <zodSchema>)` (already
   audited). Field names in the zod `z.object({ ... })` MUST match the form's
   `useState` keys exactly — same casing.

2. The route's success envelope MUST nest the created row under a key that
   contains an `id` string:

   ```ts
   return okJson({ post: { id: row.id, title: row.title } });
   ```

   The runner reads the first object-shaped value with an `id` to verify the
   DB row by primary key.

3. The route INSERTs into a single Postgres table with a literal name (must
   match the corresponding `forms[].dbTable`):

   ```sql
   INSERT INTO "posts" (...) VALUES (...) RETURNING id;
   ```

### Edit pages (`src/app/(app)/<resource>/[id]/edit/page.tsx`)

Every `forms[]` entry whose `purpose === "edit"` must have a real edit page
that loads the existing row, lets the user mutate it, and PATCHes back. The
runner uses the same parsing rules as create forms — sibling labels, single
`useState`, stable `submitName` — plus:

1. Pre-fill `form` state from the loaded row before the user can interact.
   The runner sees the existing values via Playwright's input.value() and
   knows which fields the spec marked as required.
2. Submit calls `fetch("/api/<resource>/<id>", { method: "PATCH", body: ... })`.
3. The PATCH API returns the same envelope shape (`okJson({ <ref>: { id, ... } })`).

### Delete controls (one per `deleteFlows[]` entry)

For every `deleteFlows[]` entry, render a delete button at the declared
`surface` with the exact `controlName` text:

```tsx
<button onClick={onDelete}>{/* matches spec.deleteFlows[].controlName */}Delete</button>
```

When the spec sets `confirmName`, render a confirmation modal whose confirm
button accessible name matches `confirmName` exactly. The DELETE API removes
the row via `DELETE /api/<resource>/<id>` and returns `okJson({ id })`.

### Settings forms (one per `settingsForms[]` entry)

For every `settingsForms[]` entry under `tabSlug`:

1. Render the form on `/settings/<tabSlug>` (or `/settings` for tabSlug=
   `profile`) using the same form patterns as create pages.
2. `submitName` matches verbatim. Field names match the `useState` keys and
   the API zod schema.
3. The persistence kind dictates server behavior:
   - `user_secret`: server route calls `setUserSecret(userId, providerSlug, value)` from `@/lib/server/secrets/user-secret-store`.
   - `db_column`: server route UPSERTs the column on the declared `dbTable`.
   - `get_roundtrip`: implement a corresponding `GET` route at `getEndpoint` that returns the persisted value under `returnedField`.

### Scheduled actions (one per `scheduledActions[]` entry)

For every `scheduledActions[]` entry, the form whose `ref === formRef` must
include the `datetimeField` as an `inputType: "datetime-local"` (or compatible
date+time pair). Submitting with a future datetime must persist the row with
that timestamp in the DB. The page at `calendarRoute` must render that row in
a slot that contains the row's `dbTitleColumn` value as visible text.

### Status transitions (one per `transitions[]` entry)

For every `transitions[]` entry, render a button with the exact `controlName`
on the declared `surface`. Clicking the button must execute a server action
that updates `dbColumn` from `fromValue` to `toValue` for the row. The
runner reads the DB column post-click to confirm the transition.

### Integration touchpoints

For every `integrationTouchpoints[]` entry:

- `stubable`: implement the integration with a no-op fallback when the
  provider key is missing — the tester drives the form with a fake key and
  expects the UI not to error out.
- `test_via_settings_form_only`: ensure the named settings form actually
  saves a usable value (the runner just verifies the settings form persists).
- `requires_real_credentials`: the runner yellow-skips. Just make sure the
  integration is wired correctly so when a real key is present, it works.

### Navigation & re-entry (read carefully — auto-audited after impl)

Use the **`navigation`** block in **./mvp-build-spec.json** as the single source of truth for IA. The same block is auto-inferred from `primaryAppRoutes` if Claude omits it, so it is always present.

### Hard rule — literal hrefs only

ARIA's navigation audit is a **regex grep** over `src/{app,features,components,lib,hooks,config}`. It matches **literal route strings** in file contents — it does NOT evaluate JS expressions. A page that links via a constant or a computed path **WILL FAIL THE AUDIT** even if the link works at runtime.

You MUST use literal string hrefs for every route in `primaryAppRoutes`:

```tsx
// ✅ CORRECT — literal href the audit can grep:
<Link href="/home/kits">Kits</Link>
<Link href="/home/kits/new">+ New Kit</Link>
<Link href={`/home/kits/${kit.id}`}>{kit.title}</Link>   // template literal with literal prefix
redirect("/home/kits")

// ❌ WRONG — audit cannot see these:
<Link href={routes.kits}>Kits</Link>
<Link href={`${BASE}/kits`}>Kits</Link>
{ROUTES.map((r) => <Link href={r.path}>{r.label}</Link>)}
const KITS = "/home/kits"; <Link href={KITS}>Kits</Link>
```

### CRITICAL — never use literal `[bracket]` segments in any href / redirect / router call

Routes containing `[id]`, `[slug]`, `[orgId]`, etc. are **dynamic placeholders** in the App Router file system — they are NOT real URL paths. A literal href like `<Link href="/home/boards/[id]/listings/new">` will navigate the user to that exact URL, where `useParams().id === "[id]"` and the resulting API call (e.g. `POST /api/boards/[id]/listings`) returns **404**. This is a real bug we have observed in production MVPs.

**The only correct way to link to a child-of-dynamic route is a template literal** that interpolates the actual id from the parent context (a list row, a detail page, a row variable). Examples:

```tsx
// ✅ CORRECT — template literal substitutes the real id at render time:
<Link href={`/home/boards/${board.id}/listings`}>View Listings</Link>
<Link href={`/home/boards/${board.id}/listings/new`}>+ New Listing</Link>
router.push(`/home/boards/${board.id}`)
redirect(`/home/boards/${newId}`)

// ❌ WRONG — these all 404 because the literal "[id]" goes to the network:
<Link href="/home/boards/[id]/listings">…</Link>
<Link href="/home/boards/[id]/listings/new">…</Link>
router.push("/home/boards/[id]")
redirect("/home/boards/[id]/listings")
```

This applies to **every** mechanism that takes a path string: `<Link href>`, `<a href>`, `router.push`, `router.replace`, `redirect()`, `Response.redirect()`, `useRouter().push()`, etc. ARIA's audit greps for literal `[bracket]` segments in path-like positions and fails the build if any are found. Use a template literal with the actual id substituted instead — there is no exception.

**Corollary — child-of-dynamic create/list/edit routes never appear in:**
- `homeHeaderActions` in `src/config/home-nav.config.ts` — the user is on `/home`, no id is in scope.
- `homeSubNav` in `src/config/home-nav.config.ts` — same reason.
- `extraSidebarNavItems` in `src/config/sidebar-nav.config.ts` — the sidebar is page-agnostic.

The spec's `navigation.homeHeaderActions` / `navigation.homeSubNav` will already have these dynamic routes filtered out for you. If the spec asks you to add a CTA for `/home/boards/[id]/listings/new`, link to it from the **parent detail page** (`src/app/(app)/home/boards/[id]/page.tsx`) using a template literal — never from `/home`.

### Standard wiring

- **Persistent header CTAs.** For every entry in `navigation.homeHeaderActions`: render the action in the **header of /home** so it is visible **identically in empty AND populated states**. Never hide it once data exists. Never gate it behind a "create your first" flow only.
- **Wire header actions through the template extension point.** Write to **`src/config/home-nav.config.ts`** (added by the template) — `homeHeaderActions` and `homeSubNav` arrays. Each entry MUST be a literal object whose `href` is a **static** path: `{ label: "Kits", href: "/home/kits" }`. Hrefs containing `[bracket]` are forbidden (see the rule above). Do **not** hand-edit `src/components/app/app-shell.tsx` or `src/components/app/home-shell.tsx` — they read the config file at render time.
- **Empty states augment, not replace.** A populated list page renders the persistent header CTA AND the list rows. An empty state can render an additional large illustrated CTA, but the header CTA remains. The rule: if a user can do an action when the page is empty, they can do the same action without leaving the page when it's populated.
- **List → detail → back.** Every `detail`-class route (`/home/foo/[id]`) must have:
  1. an inbound template-literal link from its parent `list` page, e.g. `<Link href={\`/home/foo/${row.id}\`}>{row.title}</Link>`, AND
  2. an outbound back-link or breadcrumb on the detail page itself, e.g. a literal `<Link href="/home/foo">← Back to Foo</Link>` in the page header.
- **List → create.** Every `create`-class route (`/home/foo/new`) must have an inbound literal `<Link href="/home/foo/new">` from at least one of: `/home` header (via `homeHeaderActions`), the parent list page header, or a list-row `+` button. **Child-of-dynamic** create routes (`/home/boards/[id]/listings/new`) are reached from the **parent detail page** instead, via a template literal — never from `/home`. Empty-state CTAs **count as additional**, never as the only entry point.
- **Sub-nav.** When the spec lists multiple **static** list routes under `/home` (e.g. `/home/monitors` and `/home/leads`), populate `homeSubNav` with literal entries so users can switch between them from `/home`. Dynamic list routes (`/home/boards/[id]/listings`) are linked from the parent detail page only.
- **No URL-only screens.** Every route in `primaryAppRoutes` must have at least one inbound `<Link>` from another route in the app. No screen is reachable only by typing the URL.

### How the audit decides (so your wiring satisfies it)

For each route in `navigation.routeClasses` (kind ∈ `list` / `create` / `edit` / `detail`), the audit:

1. Builds a regex that matches the route as a **terminated literal** (`/home/kits` matches only when followed by a quote, whitespace, `?`, `#`, `)`, `}`, or end of file — never when followed by `/`).
2. Greps every file in `src/{app,features,components,lib,hooks,config}` (skipping the route's own `page.*` file) for that regex.
3. If zero files match → fails.

The audit also runs `audit-home-nav-config` which specifically checks `src/config/home-nav.config.ts` for an entry whose `href:` matches each route in `navigation.homeHeaderActions` / `navigation.homeSubNav`.

Run **`npm run lint`** and **`npm run build`** after substantive edits. ARIA also runs an automated navigation audit on your output before the build is accepted — see the implement prompt.
