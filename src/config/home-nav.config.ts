/**
 * Home-nav extension point — populated by ARIA codegen for the ChurnDiary MVP.
 *
 * Renders persistent header CTAs and a sub-nav strip on `/home` via `home-shell.tsx`.
 *
 * Static literal hrefs only — the audit greps for these strings.
 */

export type HomeHeaderAction = {
  label: string;
  href: string;
};

export type HomeSubNavItem = {
  label: string;
  href: string;
};

export type HomeNavConfig = {
  homeHeaderActions: HomeHeaderAction[];
  homeSubNav: HomeSubNavItem[];
};

export const homeNavConfig: HomeNavConfig = {
  homeHeaderActions: [
    { label: "+ Log Cancellation", href: "/home/cancellations/new" },
    { label: "+ Add Trial", href: "/home/trials/new" },
  ],
  homeSubNav: [
    { label: "Cancellations", href: "/home" },
    { label: "Active Trials", href: "/home" },
  ],
};
