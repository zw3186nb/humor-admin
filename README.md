# Three Takes Admin

The admin area for [Three Takes](https://github.com/zw3186nb/Project_One), the photo-caption
rating app. It manages two databases:

- **Three Takes** (the same Supabase project as the main app): users, memes, captions, votes.
- **Humor engine** (the course's teaching database, a separate Supabase project): prompt
  chains, their steps and mix, LLM models/providers/responses, terms, generation examples,
  images, and who may sign up.

## What it does

| Section | Access |
| --- | --- |
| **Dashboard** | Statistics: votes per day, which AI voice wins most, busiest voting hours, whether the most-voted caption is longer or shorter, funniest and most divisive caption, top voters and photographers, recognized locations |
| **Users** | READ every profile with activity counts; make someone an admin or remove admin rights (never your own) |
| **Memes & captions** | CREATE a new meme (upload an image, AI or hand-written captions), replace an image, edit its note, DELETE a photo; CREATE / READ / UPDATE / DELETE captions |
| **Votes** | READ every upvote/downvote on captions and jokes |
| **Humor engine** | READ prompt chains, chain steps, generation requests, LLM responses, AI captions; READ/UPDATE the chain mix and images; CREATE/READ/UPDATE/DELETE terms, generation examples, LLM models, LLM providers, allowed sign-up domains, whitelisted e-mails |

### Week 7 changes (from Week 6 feedback)

1. "Does length matter?" now compares **the most-voted caption on each photo** with the
   other captions ("winning" was ambiguous).
2. Removed "AI models used" (only one model is used, so it said nothing).
3. Admin rights can be changed on the Users page (`set_superadmin` in `supabase/week7-admin.sql`).
4. Memes: create a new meme with your own image and captions, replace a photo, edit its note,
   or delete it.
5. New **Humor engine** section for the Week 7 tables. All its pages share one table view
   and one pair of server actions, configured in `lib/engine/resources.ts`.

## Security: three locks

1. **Login wall** (`proxy.ts`): every route except `/login` and `/auth/callback` redirects
   signed-out visitors to Google sign-in.
2. **Admin gate** (`app/(admin)/layout.tsx`, `lib/admin.ts`): signed-in users whose
   `profiles.is_superadmin` is not `true` are sent to `/denied`. Every server action checks again.
3. **The database itself** (`supabase/week6-admin.sql`, `supabase/week7-admin.sql`): Row Level
   Security policies only let admins read other people's profiles and votes or change captions
   and photos. Even a request that skipped the website would be refused.

The Humor engine database has its own users, so the app reaches it with that project's secret
key (`FUNNYSTUDY_SECRET_KEY`), from server code only. Locks 1 and 2 decide who can use it:
every engine page and action calls `requireAdmin()` first, and only listed tables and
columns can be changed.

### "Won't I be locked out?"

Nobody can make themselves an admin through the app: a trigger rejects any change to
`is_superadmin` coming from the API roles (`anon`, `authenticated`). The way in is the
**project owner's access**: in the Supabase SQL Editor (which runs as the database owner,
not as a website user) run once:

```sql
update public.profiles set is_superadmin = true where email = 'you@example.com';
```

## Run locally

```bash
cp .env.example .env.local   # fill in the same Supabase URL and anon key as Three Takes
npm install
npm run dev                  # http://localhost:3000
```

Add `http://localhost:3000/auth/callback` and the deployed `/auth/callback` URL to
Supabase → Authentication → URL Configuration → Redirect URLs.
