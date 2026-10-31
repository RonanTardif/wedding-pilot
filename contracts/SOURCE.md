# Vendored contracts

`usage-event.v1.json` is a verbatim copy of the Factory contract (do not edit by hand):

- Source repository: `RonanTardif/atlas-factory` (private, so CI cannot fetch it)
- Path: `packages/contracts/schemas/usage-event.v1.json` (generated from `packages/contracts/src/usage-event.ts`, zod)
- Commit: `cad9f2f4c9ef9a2289384758b00353484d333045`

To update it, copy the file again from a newer atlas-factory commit, update the commit above, and run `pnpm test`
(`tests/usage-analytics/contract.test.ts` checks that every event the app can build still validates).
