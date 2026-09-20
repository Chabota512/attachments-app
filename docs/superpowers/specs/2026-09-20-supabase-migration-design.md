# Career Compass Supabase Migration Design

## Status

Approved by the user on September 20, 2026.

## Goal

Move Career Compass from device-only persistence to a Supabase-backed account
system while preserving offline access to cached data. AI remains on the
existing Replit API temporarily because the current Supabase connection does
not provide a compatible Gemini runtime.

## Architecture

- Supabase Auth provides email/password accounts and session tokens.
- Supabase Postgres is the primary cloud store for profiles, applications,
  contacts, saved events, CV documents, letters, companies, and interview
  sessions.
- The mobile app keeps a local cache and an offline mutation queue in
  AsyncStorage.
- The API server is the authenticated data gateway and continues to host
  Gemini-powered features.
- Supabase Edge Function source and deployment configuration are prepared as
  a follow-up once Supabase management deployment access is available.

## Data and synchronization

Cloud records use stable UUIDs, `updated_at`, `deleted_at`, and an idempotency
key for queued mutations. The client reads cached records while offline,
queues create/update/delete operations, and flushes the queue when the network
returns. Sync is safe to retry and reports conflicts instead of silently
discarding data.

On first account sign-in, the app offers to upload existing local records to
the new account. Cloud data is then treated as the source of truth while the
local cache remains available for offline use.

## Authentication and data access

The API exposes email/password signup, login, refresh, and logout routes. It
forwards authenticated requests to Supabase through the Replit connector, so
Supabase credentials never enter the mobile bundle. Every data request is
scoped to the authenticated user's ID.

## AI behavior

AI requests remain on the Replit API and are never attempted while offline.
Routes use bounded timeouts, bounded retries, structured error codes, and
clear retryable/non-retryable responses. Provider failures must not produce
fabricated letters, research, questions, or verdicts.

## Verification

- Typecheck mobile and API packages.
- Verify Supabase connection health without logging credentials.
- Verify auth and persistence routes return structured errors.
- Verify the mobile app still renders onboarding and offline cached state.
- Restart the API and Expo workflows after dependency or server changes.