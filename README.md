# Hawk Quotient Sync

Cloudflare Worker that syncs Hawk Quotient lifecycle events from the existing Hawk Supabase project into the existing Google Sheet tab `⚡ Quotient Import`.

Quotient must keep sending webhooks to the existing Supabase Edge Function:

```text
https://yaeyjliirqyyqgqvuicz.supabase.co/functions/v1/sync-quotient-webhook
```

This Worker reads Supabase after that function has processed events. It does not replace the production Hawk dashboard webhook.

## Behavior

- Reads processed raw events from `public.quotient_events_raw`.
- Handles `quote_sent`, `quote_accepted`, and `quote_declined`.
- Matches Google Sheet rows by `QUOTE #`.
- Appends a row if the quote number is not found.
- Updates only automated fields for existing rows.
- Never updates manual columns:
  - `I DATE COMPLETED`
  - `K DEPOSIT AMOUNT`
  - `L DEPOSIT DATE`
- Stores processed Supabase raw event IDs in D1.

## Sheet Mapping

| Sheet column | Source |
| --- | --- |
| `A QUOTE #` | `payload.quote_number` |
| `B DATE QUOTED` | Perth date from `payload.first_sent` |
| `C ESTIMATOR` | `payload.from` |
| `D CUSTOMER` | `payload.quote_for.name_first` + `payload.quote_for.name_last`, fallback `payload.for` |
| `E FLOORING STREAM` | blank |
| `F DESCRIPTION` | `payload.title` |
| `G STAGE` | `payload.quote_status` |
| `H STAGE CHANGE` | blank for sent; Perth date from `accepted.when` or `declined.when` |
| `J VALUE` | `payload.total_excludes_tax` |

Dates are written as `DD/MM/YYYY`.

## Required Secrets

Set these in Cloudflare:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GOOGLE_CLIENT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
npx wrangler secret put GOOGLE_SHEET_ID
```

Optional manual trigger protection:

```bash
npx wrangler secret put SYNC_SHARED_SECRET
```

Non-secret config lives in `wrangler.json`:

- `SUPABASE_URL`
- `GOOGLE_SHEET_TAB_NAME`
- `SUPABASE_EVENT_LIMIT`

The Google service account must have edit access to the target Google Sheet.

## Local Development

```bash
npm install
npm run seedLocalD1
npm test
npm run check
```

Run locally:

```bash
npm run dev
```

Manual sync endpoint:

```bash
curl -X POST "http://localhost:8787/sync"
```

If `SYNC_SHARED_SECRET` is configured:

```bash
curl -X POST "http://localhost:8787/sync" \
  -H "Authorization: Bearer $SYNC_SHARED_SECRET"
```

Health endpoint:

```bash
curl "http://localhost:8787/health"
```

## Deploy

```bash
npm run deploy
```

`predeploy` applies remote D1 migrations before deployment.
