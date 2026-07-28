# InCheck 360 AI Checklist Engine

A ready-to-run React + Supabase project for creating operational checklists manually or with AI.

## Included

- Dark, responsive checklist builder matching the supplied field-library layout
- All 23 requested item types
- Section and item management
- Item-specific settings for measurements, choices, ratings, media, scanning, formulas, and timers
- Required, critical, N/A, scoring, evidence, and corrective-action rules
- Mobile checklist preview
- AI generation from a description or pasted SOP/procedure text
- Supabase Auth, Postgres schema, RLS policies, version snapshots, and publish RPC
- Supabase Edge Function that securely calls the OpenAI Responses API with Structured Outputs
- Local demo mode using `localStorage` when Supabase environment variables are absent

## Project structure

```text
src/                         React/Vite application
supabase/migrations/         Database schema, RLS, triggers, publish function
supabase/functions/          AI checklist generation Edge Function
.env.example                 Browser-safe Supabase variables
```

## 1. Run immediately in local demo mode

No backend is required for this preview mode.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Checklists are stored in your browser.

## 2. Create and connect a Supabase project

Install the Supabase CLI, log in, and link this folder to your project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Copy `.env.example` to `.env` and fill in the public project values from **Supabase Dashboard → Project Settings → API**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Restart Vite after changing `.env`.

## 3. Configure the AI Edge Function

Store the OpenAI API key as a Supabase secret. Never put it in the browser `.env` file.

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
npx supabase secrets set OPENAI_MODEL=gpt-5.6-luna
npx supabase functions deploy generate-checklist
```

`OPENAI_MODEL` is configurable. Change it to a structured-output-capable model available in your OpenAI project when needed.

## 4. Authentication

When Supabase variables are configured, the application automatically enables email/password authentication. In Supabase Dashboard, review:

- **Authentication → Providers → Email**
- Email confirmation setting
- Site URL and redirect URLs for production

For local development, `http://localhost:5173` is already included in `supabase/config.toml`.

## 5. Production build

```bash
npm run build
npm run preview
```

The production files are generated in `dist/` and can be deployed to Vercel, Netlify, Cloudflare Pages, or another static host.

Add these environment variables to the hosting platform:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Database model

- `profiles`
- `checklists`
- `checklist_sections`
- `checklist_items`
- `checklist_versions`
- `ai_generation_logs`

All user-facing tables use Row Level Security. A signed-in user can only access checklists they own. The OpenAI key is available only inside the Edge Function.

## Publishing and versions

Publishing calls `public.publish_checklist(...)`, which stores a full JSON snapshot in `checklist_versions` and increments the version number. Editing a published checklist in the UI returns it to draft status while the previous published snapshot remains unchanged.

## AI output rules

The Edge Function restricts AI output to these field types:

`checkmark`, `yes_no`, `signature`, `staff_member`, `multiple_choice`, `video`, `picture`, `qr`, `barcode`, `measurement`, `rating_1_5`, `rating_1_10`, `rating_custom`, `formula`, `date_time`, `date`, `time`, `stopwatch`, `long_entry`, `short_entry`, `instructions`, `title`, `sub_checklist`.

The function uses a strict JSON schema and returns a structured checklist draft. The frontend assigns UUIDs before saving it to Postgres.

## Useful commands

```bash
npm run typecheck
npm run build
npx supabase start
npx supabase functions serve generate-checklist --env-file supabase/functions/.env
npx supabase db reset
```

## Security notes

- Keep the Supabase service-role key and OpenAI API key out of frontend code.
- The included frontend uses only the Supabase anonymous key, protected by RLS.
- Review role and sharing requirements before enabling organization-wide access.
- Add rate limiting or usage quotas before a public launch of AI generation.
