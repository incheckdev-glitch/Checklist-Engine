# Deployment Checklist

1. Create a Supabase project.
2. Run `npx supabase link --project-ref YOUR_PROJECT_REF`.
3. Run `npx supabase db push`.
4. Configure email authentication.
5. Run `npx supabase secrets set OPENAI_API_KEY=...`.
6. Optionally set `OPENAI_MODEL`.
7. Deploy with `npx supabase functions deploy generate-checklist`.
8. Copy `.env.example` to `.env` and add the Supabase URL and anonymous key.
9. Run `npm run build`.
10. Deploy `dist/` and add the two `VITE_` environment variables to the host.
11. Add the production domain to Supabase Auth redirect URLs.
12. Test sign-up, save, AI generation, preview, publish, and version creation.
