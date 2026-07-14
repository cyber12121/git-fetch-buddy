Goal: Bring the code from https://github.com/cyber12121/adhd-planner.git into this Lovable project, since Lovable cannot directly import/clone an existing GitHub repository.

```text
Current state:  Fresh Lovable TanStack Start project
Target state:   Project contains the ADHD planner code from the GitHub repo,
                adapted to run under TanStack Start / Vite / Tailwind v4
```

## What we’ll do

1. **Inspect the GitHub repo**
   - List top-level files and folder structure via the GitHub API connector.
   - Identify the framework (e.g. React, Vite, Next.js, plain HTML) and dependencies.
   - Locate entry points, routes, components, styles, and any backend code.

2. **Decide migration strategy**
   - If the repo is already a Vite/React app close to the Lovable stack: overlay files carefully.
   - If it uses a different framework (Next.js, plain HTML, etc.): rewrite routes into `src/routes/` and move components into `src/components/`.
   - Preserve only reusable code; do not overwrite Lovable bootstrap files (`src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/start.ts`, `vite.config.ts`) unless the repo is intentionally replacing the whole shell.

3. **Copy files into the project**
   - Fetch key files from GitHub using the connector and write them into the correct Lovable paths.
   - Create route files under `src/routes/` for each page/screen.
   - Move reusable UI into `src/components/`.
   - Move styles/assets into `src/` and `public/` as appropriate.

4. **Resolve dependencies**
   - Read the repo’s `package.json`.
   - Add any missing npm packages with `bun add`.
   - Flag any packages that are incompatible with the Cloudflare Worker server runtime.

5. **Fix build/runtime issues**
   - Update imports to match the new file layout.
   - Convert any framework-specific APIs (e.g. Next.js `useRouter`, `getServerSideProps`) to TanStack Router/Start equivalents.
   - Ensure the root route still renders `<Outlet />`.
   - Replace the placeholder `src/routes/index.tsx` content.

6. **Verify**
   - Run the build/typecheck.
   - Check the preview for errors and correct rendering.

## Important constraints

- Lovable cannot clone or sync **from** GitHub into a project. The GitHub connector only lets the app read GitHub data via API.
- The final app will use this Lovable project’s existing TanStack Start shell, not the repo’s original framework shell, unless the repo is fully self-contained and we intentionally replace the shell.
- Some server-side or Node-only dependencies may need to be swapped for Worker-compatible alternatives.

## First step if you approve

I’ll fetch the repo’s root directory listing and `package.json` to see what we’re working with, then propose the exact file mapping before copying anything.