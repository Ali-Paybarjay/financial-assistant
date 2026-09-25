import { Megaphone } from "@phosphor-icons/react/dist/ssr";

/**
 * The one sentence an operator can put above the app without a deploy.
 *
 * Same grammar as <GuestBanner> and the same amber, because it means the same
 * kind of thing: this is provisional, and it is about the app rather than about
 * your money. A red banner would read as «something is wrong with your
 * account», which is the one message it must not send.
 *
 * A server component, unlike the guest banner — the text comes from
 * `app_settings` in the layout, so there is nothing for the client to decide.
 */
export function MaintenanceBanner({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-guess-border bg-guess-tint px-4 py-2 text-caption text-guess-text"
    >
      <Megaphone size={15} weight="fill" className="shrink-0 text-guess" />
      <p className="min-w-0">{text}</p>
    </div>
  );
}
