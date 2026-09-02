# `@travel/auth`

[Better Auth](https://better-auth.com) for the travel product, backed by
`@travel/db`. A fork of `@crm/auth` with five differences:

| Aspect | `@crm/auth` | `@travel/auth` |
| --- | --- | --- |
| Organization | Singleton `WORKSPACE_ID` | Real tenant, one per agency |
| Create organization | `allowUserToCreateOrganization: false` | `true` |
| Invitations | Unused | The advisor onboarding flow |
| Email + password | Disabled | Enabled, Google optional |
| `ALLOWED_SIGN_IN` | The access list | Not used. This is SaaS |
| Cookie prefix | `crm` | `travel` |

## Roles

Plain string roles plus predicate functions in `src/agency.ts`: `owner`,
`admin`, `agent`, `accountant`. `canManageAgency`, `canManageMembers`,
`canSeeMargins`, `canRecordPayment` gate the service **and** the UI control, so
the button and the 403 never disagree. There is no `createAccessControl` — the
`Member.role` column is a free string the API writes through Prisma.

## Cookie prefix

`AUTH_COOKIE_PREFIX = "travel"` is set in two places: `advanced.cookiePrefix` in
`auth.ts` and `getSessionCookie(request, { cookiePrefix })` in the app's
`proxy.ts`. One alone redirects every signed-in request. That is why
`./cookies` is its own subpath export.

## Invitations

`sendAgencyInvitation` follows the capability pattern: a missing key removes a
capability and never throws.

- `TRAVEL_RESEND_API_KEY` and `TRAVEL_INVITATION_FROM` both set → the email is
  sent, `{ delivered: true, url }`.
- Either unset → `{ delivered: false, url }`. No error, no alarm log.
- A provider failure → `{ delivered: false, url }`.

The API's `agency.invite` always returns the `url`. The email is an extra, not
the mechanism.

## Changing the schema — read before running `travel:auth:generate`

`better-auth generate` rewrites the auth-owned models in
`packages/travel-db/prisma/schema.prisma` and **deletes what it does not know**.
`Organization` there carries ~18 hand-written inverse relations (`quotes`,
`bookings`, `customers`, `settings`, `counters`, …) and `Member.role` has
`@default("agent")`. The CLI removes both.

Mandatory flow:

```bash
bun run travel:auth:generate
git diff packages/travel-db/prisma/schema.prisma   # restore Organization's inverse relations and Member.role's default by hand
bun run travel:migrate
```

Review the diff every time.
