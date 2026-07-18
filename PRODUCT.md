# Product

## Register

product

## Platform

web

## Users

A single self-hosted household. One technically-comfortable person (the maintainer) runs the instance and does most of the setup — creating accounts, defining recurring bills and income — while one or two other household members read it to answer everyday money questions. There's no login; everyone shares one view of the same finances.

That split is the core design tension: the primary user thinks like a power user and wants density and speed, but the people reading the numbers may not be finance-savvy. The interface has to serve an expert without becoming cryptic to the rest of the household.

Context of use: at a desk or on the couch, checking "are we okay?" before a purchase, or sitting down periodically to reconcile what actually happened against what was projected.

## Product Purpose

BananaBook is a forward-looking checkbook. Instead of reporting what you already spent, it projects each account's balance forward — a day, a month, up to two years — from a starting balance plus recurring deposits and expenses, and tells you the exact date the balance is projected to go negative.

The reconcile loop keeps that forecast honest: projected items get confirmed (or corrected) against real amounts as they happen, so the projection you trusted last month still holds up this month.

Success is a household that is never surprised by an overdraft — they saw it coming with enough lead time to move money or cut spending.

## Positioning

The one screen that answers "when will we run out of money," with a specific date and enough warning to act — not a rear-view report of what already happened, and not a static spreadsheet you have to re-math by hand.

## Brand Personality

Sharp and precise: a well-made financial instrument, not a friendly budgeting toy and not an institutional banking portal. The numbers are the product. The reference point is a trading terminal — dense, tabular, information-rich, monospaced numerics you can scan fast — tuned down enough that a non-expert can still read the verdict at a glance. Confident and quiet. It states the situation plainly, including bad news, and trusts the user to handle it.

## Anti-references

- **Generic SaaS blue** — the current create-next-app default (blue-600 buttons, gray text on gray cards, identical rounded card grids, emoji status badges). This is the baseline to move away from, not a style to preserve.
- **Big-bank corporate** — navy-and-gold, stock-photography trust, stuffy institutional weight.
- **Cutesy / over-playful** — leaning into the banana pun with mascots, cartoons, bright yellow, bubbly rounded everything. The name is a wink, not a theme.
- **Crypto / neon fintech** — glowing gradients, purple-to-pink, dark-for-cool's-sake, hype-dashboard energy.

## Design Principles

Forecast first. The future balance is the hero of every screen, not the transaction log. The lead question is always "are we going to be okay, and when" — the answer should be readable before any detail.

Numbers are the interface. Set figures like a terminal: aligned on the decimal, tabular, monospaced, instantly scannable. Never make someone hunt across a card for a dollar amount.

Dense but never cryptic. Information density serves the power user; plain-language verdicts serve the rest of the household. A family member who doesn't think in cash-flow should still get the headline at a glance.

Earn trust through honesty. The reconcile loop — projected versus actual — is what makes the forecast believable. Surface the difference and state bad news plainly; a forecast that hides its errors isn't worth trusting.

Restraint is the brand. No decoration that isn't data. Resist both reflexes — the banana-cute one and the SaaS-blue one — equally.

## Accessibility & Inclusion

WCAG 2.1 AA as the non-negotiable baseline: AA contrast on all text, full keyboard operability, and a `prefers-reduced-motion` alternative for every animation. Because the app leans on red/green for over/under and negative/positive, color is never the only signal (WCAG 1.4.1) — pair it with sign, icon, shape, or label so the meaning survives for color-blind readers and in grayscale.
