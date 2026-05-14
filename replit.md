# Career Compass

A mobile app helping Zambian students find WIL (Work-Integrated Learning) placements, internships, and graduate opportunities — with AI-powered onboarding, job matching, and a live networking events feed.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with Expo Router, @tanstack/react-query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: Gemini 2.5 Flash via Replit Gemini integration (with Google Search grounding)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/app/(tabs)/` — Tab screens: Dashboard, Jobs, Companies, Network, Profile
- `artifacts/mobile/app/(tabs)/contacts.tsx` — Network tab: live event feed + contacts manager
- `artifacts/mobile/app/(tabs)/index.tsx` — Dashboard with saved events section
- `artifacts/mobile/context/AppContext.tsx` — Global state: profile, contacts, saved events
- `artifacts/mobile/constants/colors.ts` — Design tokens (dark theme, primary indigo #6366f1)
- `artifacts/api-server/src/routes/ai.ts` — All AI routes incl. `/ai/networking-events`
- `lib/api-spec/openapi.yaml` — Source-of-truth API contract

## Architecture decisions

- **Contract-first API**: OpenAPI spec in `lib/api-spec/openapi.yaml` drives codegen (Zod schemas + React Query hooks). Never write API types by hand.
- **Gemini + Google Search grounding** for the Network tab: instead of static event data, Gemini searches the live internet on each request. Covers Facebook Events, LinkedIn, Eventbrite, Meetup.com, Zambian news sites, university portals, etc.
- **Zambia-first market**: all AI prompts for the Network tab prioritise Lusaka, Ndola, Kitwe, Livingstone, and other Zambian cities. International/African events included as secondary scope, especially for online events.
- **Broad event taxonomy** (20 types): not rigid — the AI returns whatever real events exist (hackathons, awards, alumni events, webinars, open days, mentorship, trade fairs, pitch competitions, etc.) and the UI filters them.
- **AsyncStorage persistence**: saved events, contacts, and user profile all persist locally on the device. No login required.

## Product

- **Onboarding**: AI chat flow collects name, degree, university, city, industries of interest, and career goals.
- **Dashboard**: Quick summary of saved events, saved jobs, and application tracker.
- **Jobs**: Browse and save WIL/internship job listings.
- **Companies**: Browse companies offering graduate/internship programmes.
- **Network tab**: Live feed of 8–15 real upcoming networking events (scraped from the internet on demand via Gemini + Google Search). 20 filter categories, sort options, bookmark to Dashboard. Contacts manager accessible via top-right icon.
- **Profile**: View and edit user profile.

## User preferences

- **Mobile only** — all work is done on the Expo mobile app. No web app or website.
- App targets **Zambian** students seeking WIL placements.
- Network tab must show ALL types of opportunities — not rigid/limited categories. Wide net: hackathons, alumni events, awards, mentorship, open days, pitch events, trade fairs, community events, sports, cultural events, etc.
- Search must be Zambia-first but not Zambia-only — international and African online events are welcome.
- AI search must use the student's profile details (degree, city, industries, goals) to personalise results, but NOT be so narrow that diverse opportunities are missed.
- Dark theme: background `#0a0a1e`, primary `#6366f1` indigo.

## Gotchas

- Pre-existing TypeScript errors in `components/ErrorFallback.tsx` and `app/+not-found.tsx`: they reference `colors.foreground` which doesn't exist in the palette (should be `colors.text`). These are harmless at runtime but will show in `typecheck` output. Fix when touching those files.
- `useColors.ts` has a pre-existing TS2352 error due to the `radius` field type mismatch — also harmless at runtime.
- Network tab event fetch takes 10–20 seconds (Gemini + Google Search grounding is slow). The skeleton loading UI handles this gracefully.
- Never call service ports directly (e.g. `localhost:5000`). Always use the shared proxy at `localhost:80/api/...`.
- Do not run `pnpm dev` at the workspace root — use workflows instead.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- For adding real event data APIs (Eventbrite, Serper.dev, Tavily, Meetup.com), see the inline comments in `artifacts/api-server/src/routes/ai.ts` above the `/ai/networking-events` route.
