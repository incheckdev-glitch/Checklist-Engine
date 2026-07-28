# Vercel build fix

The Vercel TypeScript build errors reported on 28 July 2026 were fixed as follows:

1. `src/App.tsx`
   - Uses optional chaining for the nullable Supabase client when signing out.

2. `src/lib/catalog.tsx`
   - Uses Lucide's official `LucideIcon` type instead of a narrower custom React component type.
   - This supports the Lucide `size` prop as `string | number`.

3. `tsconfig.node.json`
   - Adds `noEmit: true`, which is required when `allowImportingTsExtensions` is enabled.

Expected Vercel command:

```bash
npm run build
```
