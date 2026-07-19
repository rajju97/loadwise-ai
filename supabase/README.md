# Supabase setup

Run `schema.sql` once in a new Supabase project. It creates the organization model, catalog tables, optimization history, signup trigger, explicit Data API grants, and RLS policies.

After applying it:

1. Run Security Advisor and Performance Advisor.
2. Register a test user through the app.
3. Confirm that one profile, organization, and owner membership were created.
4. Use a second user to verify that organization rows are not visible across accounts.
5. Add the Vercel domain under Authentication URL Configuration.
