# Claude Code Rules

## Pre-push Requirements

**Always run `npm run build` before pushing.** This project has a Husky `pre-push` hook that enforces this automatically, but Claude should also verify the build succeeds before attempting a push.

```bash
npm run build
```

If the build fails, fix all TypeScript and build errors before pushing.

## Development Workflow

1. Make code changes
2. Run `npm run lint` to check for lint errors
3. Run `npm test` to run the test suite
4. Run `npm run build` to verify the build passes
5. Commit and push — the `pre-push` hook will re-run the build as a final check

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Dexie (IndexedDB) for local storage
- Zustand for state management
- Vitest for testing
- Cloudflare Pages for deployment (`npm run deploy`)
