## What changed

<!-- A short description of the change and why it is needed. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / chore
- [ ] Documentation
- [ ] Schema or migration change

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes, and new behaviour has tests
- [ ] `npm run build` succeeds
- [ ] Any schema change ships with a Prisma migration in `prisma/migrations/`
- [ ] No secrets, API keys or personal data added to the repo

## Security review

- [ ] New endpoints authenticate the caller and authorize ownership via the service layer
- [ ] All user input is validated with a Zod schema
- [ ] No raw HTML is rendered from user-supplied content

## Screenshots

<!-- For UI changes, attach before/after screenshots. -->
