/**
 * The app is two apps.
 *
 * «حسابداری شخصی» is one person's money: accounts, a month, a ledger, goals.
 * «دنگ و دونگ» is several people's money and one trip: names, shares, and who
 * pays whom at the end. They answer different questions, they are opened on
 * different days, and mixing them was costing both of them — a dashboard with
 * a trip card in the corner, a settings page listing shared expenses under
 * «پول», and a tab bar that could hold four things and had six to offer.
 *
 * So the first screen after signing in asks which one you are here for, and
 * from then on the shell only shows that side of the app: its own nav, its
 * own pages, and nothing of the other.
 *
 * The one place the two do touch is money leaving the user's own account —
 * see migration 0017. That is a fact about the personal ledger, not a reason
 * for the trip's screens to live inside it.
 *
 * This module is the single answer to "which side am I on", derived from the
 * url rather than stored: a link, a refresh and a back button all have to
 * agree, and a remembered workspace is the one thing that cannot.
 *
 * `profiles.default_workspace` is not a counter-example, and the difference
 * is worth being precise about because it looks like one. What it stores is
 * whether opening the app should go straight to «دنگ و دونگ» — one route's
 * redirect target — and not the current workspace. Nothing reads it to decide
 * what side a page belongs to; `workspaceForPath` is still the only thing that
 * answers that, still from the url, still with nothing remembered. Remembering
 * an answer changes where one link goes; it does not make the current
 * workspace stateful.
 */

export type WorkspaceId = "personal" | "dong";

/**
 * The chooser. Not a workspace itself — it is where you stand between them.
 *
 * It has its own address rather than living at «/» with a query string. It
 * used to need one, because «/» redirected to a remembered workspace and a
 * plain link there would bounce you back where you came from. «/» is the
 * capture screen now and redirects nobody who has not asked for it, so the
 * second address that existed to escape the first one is gone.
 */
export const HUB_PATH = "/switch";

/**
 * The app's home, and the screen for recording something.
 *
 * Personal — it writes to the personal ledger — but not a page the docked bar
 * belongs on, because this screen *is* the composer at full size. The shell
 * asks about it separately for that one reason.
 */
export const CAPTURE_PATH = "/";

export function isCapturePath(pathname: string): boolean {
  return pathname === CAPTURE_PATH;
}

export type WorkspaceMeta = {
  id: WorkspaceId;
  /** What the box on the hub is called, and what the shell says you are in. */
  title: string;
  /** One line, on the hub. What this side of the app is for. */
  blurb: string;
  /** Where entering it lands you. */
  href: string;
};

export const WORKSPACES: Record<WorkspaceId, WorkspaceMeta> = {
  personal: {
    id: "personal",
    title: "حسابداری شخصی",
    blurb: "خرج و درآمد خودت، موجودی حساب‌ها، و هدف‌هایی که برایشان پس‌انداز می‌کنی.",
    href: "/dashboard",
  },
  dong: {
    id: "dong",
    title: "دنگ و دونگ",
    blurb: "سفر و دورهمی و خانه‌ی مشترک: خرج‌های چندنفره، سهم هرکس، و تسویه‌ی آخرش.",
    href: "/dong",
  },
};

/**
 * Route prefixes, listed rather than inferred. "Anything that is not /dong is
 * personal" would hand a workspace nav to /onboarding and to a 404, and the
 * shell would then tell someone standing on a missing page that they are in
 * the middle of their accounting.
 */
const ROUTES: Record<WorkspaceId, readonly string[]> = {
  personal: [
    "/dashboard",
    "/transactions",
    "/accounts",
    "/income",
    "/goals",
    "/import",
    "/settings",
  ],
  dong: ["/dong"],
};

/** `/dong` matches `/dong/<id>`; `/dongle` is not this app's page. */
function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Which side of the app this path belongs to, or null on the chooser. */
export function workspaceForPath(pathname: string): WorkspaceId | null {
  // Exact equality, and first. «/» is a prefix of every path, so listing it
  // in ROUTES.personal would hand /onboarding/3 and a 404 the ledger's nav.
  if (pathname === CAPTURE_PATH) return "personal";
  if (ROUTES.dong.some((route) => isUnder(pathname, route))) return "dong";
  if (ROUTES.personal.some((route) => isUnder(pathname, route))) return "personal";
  return null;
}
