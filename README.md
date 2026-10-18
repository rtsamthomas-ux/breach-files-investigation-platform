# Pixel Perfect Vision

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ffda186-9d71-4ba3-8fd6-6cdc5a853261).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Administrator response review

The dashboard includes an **Admin Responses** view for reviewing participant submissions. It is visible only to accounts whose `public.profiles.role` is `admin`. The server checks the signed-in account's role on every request; participant answers are not sent to ordinary participant accounts.

To enable it in a Supabase-backed deployment:

1. Apply all pending files in `supabase/migrations` to the linked Supabase project.
2. Configure the server runtime with `SUPABASE_URL` and either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Keep this secret server-side; never add it to a `VITE_*` variable.
3. Create and verify the administrator's normal account. In the Supabase SQL Editor, promote that account explicitly, replacing the email below:

   ```sql
   UPDATE public.profiles AS p
   SET role = 'admin'
   FROM auth.users AS u
   WHERE u.id = p.id
     AND lower(u.email) = lower('admin@example.com');
   ```

4. Sign in with that account. **Admin Responses** appears in the dashboard navigation and provides username search, stage filtering, paginated results, submitted answers, and scoring breakdowns.

Submissions are recorded when a participant is signed in and the server database credentials are configured. Offline/local submissions are not uploaded, and this portal cannot recover answers that were never recorded in `stage_submissions`.
