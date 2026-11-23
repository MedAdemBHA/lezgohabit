ALTER TABLE public.posts ADD CONSTRAINT posts_author_profile FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.post_reactions ADD CONSTRAINT reactions_author_profile FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT reports_author_profile FOREIGN KEY(reporter) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.post_hides ADD CONSTRAINT hides_author_profile FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_preferences ADD CONSTRAINT preferences_author_profile FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;