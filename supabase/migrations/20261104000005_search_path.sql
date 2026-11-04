-- Pin search_path on the two helper functions flagged by the Supabase linter.
-- (Already applied in production on 2026-11-04; kept here so local stacks match.)
alter function public.touch_updated_at() set search_path = public;
alter function public.is_service() set search_path = public;
