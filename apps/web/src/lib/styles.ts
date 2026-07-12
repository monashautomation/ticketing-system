/** Shared Tailwind class strings so every page/component renders one consistent, Linear-like dark UI. */

export const page = 'mx-auto max-w-3xl px-6 py-10';
export const pageWide = 'mx-auto max-w-5xl px-6 py-10';
export const pageNarrow = 'mx-auto max-w-md px-6 py-16';

export const pageHeader = 'mb-8 flex items-center justify-between gap-4';
export const pageTitle = 'text-xl font-semibold tracking-tight text-text';
export const nav = 'flex items-center gap-4 text-sm text-text-secondary';
export const navLink = 'transition-colors hover:text-text';
export const navLinkActive = 'text-text';

export const headerBar =
  'sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80';
export const headerInner =
  'mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3';
export const headerLogo = 'flex shrink-0 items-center';
export const headerNav = 'flex flex-wrap items-center gap-4 text-sm text-text-secondary';
export const headerAccount = 'flex items-center gap-3';
export const avatarCircle =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent';
export const avatarName = 'hidden text-sm font-medium text-text sm:inline';

export const backLink =
  'inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text';

export const card = 'rounded-lg border border-border bg-panel p-4';
export const cardTight = 'rounded-lg border border-border bg-panel p-3';

export const input =
  'rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-tertiary outline-none transition-colors focus:border-accent';
export const inputSm =
  'rounded-md border border-border bg-elevated px-2 py-1.5 text-sm text-text outline-none transition-colors focus:border-accent';
export const select = inputSm;
export const label = 'flex flex-col gap-1.5 text-sm text-text-secondary';
export const labelInline = 'flex items-center gap-2 text-sm text-text-secondary';

export const buttonPrimary =
  'inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50';
export const buttonSecondary =
  'inline-flex items-center justify-center rounded-md border border-border bg-elevated px-4 py-2 text-sm font-medium text-text transition-colors hover:border-border-strong hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50';
export const buttonGhost =
  'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-50';
export const buttonDanger =
  'inline-flex items-center justify-center rounded-md bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

export const badgeNeutral =
  'inline-flex items-center rounded-full bg-elevated px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-text-secondary';
export const badgeAccent =
  'inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent';
export const badgeDanger =
  'inline-flex items-center rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger';
export const badgeSuccess =
  'inline-flex items-center rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success';
export const badgeWarning =
  'inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning';

export const errorText = 'text-sm text-danger';
export const mutedText = 'text-sm text-text-secondary';

export const tableWrap = 'overflow-x-auto rounded-lg border border-border bg-panel';
export const table = 'w-full text-left text-sm';
export const tableHead = 'bg-elevated text-xs uppercase tracking-wide text-text-secondary';
export const tableHeadCell = 'px-4 py-2.5 font-medium';
export const tableCell = 'px-4 py-3';
export const tableRowDivider = 'divide-y divide-border';

