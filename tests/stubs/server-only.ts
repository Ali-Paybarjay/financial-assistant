/**
 * What `server-only` resolves to under the test runner.
 *
 * The real package has two entry points and chooses between them on a resolve
 * condition: an empty module under `react-server`, and one that throws
 * otherwise. Vitest resolves as plain Node, so every module marked
 * `import "server-only"` — which is all of `lib/queries/*` — threw before a
 * single test ran, and none of it was under test.
 *
 * This is that empty module, with the reason written down. The marker keeps
 * doing its real job in the Next build, where the condition is set and a query
 * module genuinely cannot reach a client bundle. See vitest.config.mts.
 */
export {};
