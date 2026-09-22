-- ------------------------------------------------------ default workspace --

-- Where «/» sends you, and whether it asks first.
--
-- Read the comment at the top of lib/workspaces.ts before changing this. That
-- module says the current workspace is derived from the url and never stored,
-- and that rule is untouched: a link, a refresh and a back button all have to
-- agree about which side of the app you are on, and a remembered *current*
-- workspace is the one thing that cannot.
--
-- What is stored here is different and much smaller: the default destination
-- of one route. «/» is a chooser, and for someone who only ever uses one side
-- it is a tap they pay on every visit to answer a question they have already
-- answered. Landing on /dashboard because that is where you always go does
-- not make /dong any less reachable — the switch in the header is still
-- there, and default_workspace null brings the chooser back.
alter table public.profiles
  add column default_workspace text
    check (default_workspace in ('personal', 'dong'));

comment on column public.profiles.default_workspace is
  'Where «/» redirects. null = ask every time. NOT the current workspace, '
  'which is read from the url and never stored — see lib/workspaces.ts.';
