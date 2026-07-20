# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

A fair warning on scope: BananaBook was built to serve [one specific way of managing
money](README.md#the-method) for one household. That focus is the point of it. Features
that turn it into a general-purpose budgeting app — spending categories, envelopes,
bank syncing, reporting dashboards — are likely to be declined, not because they are bad
ideas but because they are a different product.

**Open an issue before starting anything large.** It will save you the work.

## Getting set up

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/majoragee/bananabook.git
cd bananabook
npm install
npm run dev
```

That starts the Express API on port 3001 and Next.js on port 3000, and creates
`bananabook.db` in the project root on first run. Delete that file to start over.

Don't set `PORT` — both processes read it and will collide. See the README's
configuration section.

## Before opening a pull request

```bash
npm run lint
npm test
npm run build
```

All three must pass; CI runs the same commands plus an API smoke test.

New behaviour in the projection engine needs a test in
`server/routes/projections.test.ts`. The suite freezes the clock and uses a temporary
database, so add cases there rather than reaching for real dates.

## House style

- TypeScript throughout. Avoid `any`; the lint rule that forbids it is there on purpose.
- Match the surrounding code — it is fairly plain Express and React, and it should stay
  that way.
- Route handlers wrap their work in `try`/`catch` and return a JSON `{ error }` body with
  a sensible status. Keep that pattern.
- Money is currently stored as floating point. Don't add new arithmetic that compounds
  the problem; see the README's known limitations.
- The UI follows the design brief in [PRODUCT.md](PRODUCT.md) — dense, monospaced
  numerics, no decoration that isn't data. Read it before changing the interface.

## Commit messages

A short imperative subject line describing the change, e.g.
`Fix bi-weekly projection skipping a period across month boundaries`.

## Reporting bugs

Include the steps to reproduce, what you expected, and what happened. For anything
involving the projection, the recurring transaction setup that triggers it is the most
useful thing you can give — frequency, start date, and amounts.

For security problems, follow [SECURITY.md](SECURITY.md) instead of opening an issue.
