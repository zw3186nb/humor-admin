-- Week 7: run once in the Supabase SQL Editor of the Three Takes project.
-- Implements the Week 6 feedback: admins can change admin rights, and can
-- create, replace and delete photos (memes) as well as captions.

-- ── 1. Admin rights can be changed from the Users page ──────────────────
-- The trigger from week6-admin.sql still blocks the website roles from
-- touching is_superadmin directly. This function runs as the database owner,
-- checks that the caller is an admin, and refuses to change the caller's own
-- flag, so nobody can lock themselves out by accident.
create function public.set_superadmin(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only admins can change admin rights' using errcode = '42501';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You cannot change your own admin rights' using errcode = '42501';
  end if;
  update public.profiles set is_superadmin = value where id = target;
  if not found then
    raise exception 'No such user';
  end if;
end;
$$;

revoke execute on function public.set_superadmin(uuid, boolean) from public, anon;
grant execute on function public.set_superadmin(uuid, boolean) to authenticated;

-- ── 2. Admins can replace a photo, edit its note, and delete any post ───
create policy "Admins can edit posts"
  on public.posts for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

grant update (image_path, note, ai_location, ai_scene) on public.posts to authenticated;

create policy "Admins can delete any post"
  on public.posts for delete to authenticated
  using ((select public.is_superadmin()));

create policy "Admins can delete any photo file"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_superadmin()));
