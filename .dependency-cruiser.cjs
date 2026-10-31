/**
 * AD-21: DDD + hexagonal architecture rules.
 * Layout: src/<context>/{domain,application,adapters/inbound,adapters/outbound}
 * src/app is the Next.js inbound adapter shell (composition root).
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "domain-not-to-outer-layers",
      comment: "domain/ must not depend on application/ or adapters/.",
      severity: "error",
      from: { path: "^src/[^/]+/domain/" },
      to: { path: "^src/[^/]+/(application|adapters)/" },
    },
    {
      name: "application-not-to-adapters",
      comment: "application/ must not depend on adapters/ or the src/app shell (adapters implement ports).",
      severity: "error",
      from: { path: "^src/[^/]+/application/" },
      to: { path: "^src/([^/]+/adapters|app)/" },
    },
    {
      name: "domain-no-external-deps",
      comment: "domain/ is pure TypeScript: only relative imports, no npm package, no node core module, no framework.",
      severity: "error",
      from: { path: "^src/[^/]+/domain/" },
      to: { dependencyTypesNot: ["local"], couldNotResolve: false },
    },
    {
      name: "application-no-external-deps",
      comment: "application/ holds use cases and ports: only local imports, no npm package, no node core module, no framework.",
      severity: "error",
      from: { path: "^src/[^/]+/application/" },
      to: { dependencyTypesNot: ["local"], couldNotResolve: false },
    },
    {
      name: "domain-stays-in-own-domain",
      comment: "domain/ may only import files of its own domain/ (no app shell, no other context, no tests).",
      severity: "error",
      from: { path: "^src/([^/]+)/domain/" },
      to: { dependencyTypes: ["local"], pathNot: "^src/$1/domain/" },
    },
    {
      name: "no-cross-context",
      comment: "A context never imports any path of another context (nor src/app); only src/app combines contexts.",
      severity: "error",
      from: { path: "^src/([^/]+)/", pathNot: "^src/app/" },
      to: { path: "^src/[^/]+/", pathNot: "^src/$1/" },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      comment: "Every import must resolve (catches imports that cannot be resolved).",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(tests/architecture/fixtures|\\.next)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".d.ts"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
