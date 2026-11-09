import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      /**
       * `server-only` ships two entry points and picks between them on a resolve
       * condition: `empty.js` under `react-server`, and an `index.js` that
       * throws otherwise. Vitest resolves modules as plain Node, so importing
       * anything marked `import "server-only"` threw «This module cannot be
       * imported from a Client Component module» before a single test ran — and
       * `lib/queries/*` is all marked, which is why none of it was under test.
       *
       * Aliased to the package's own server entry point rather than stubbed:
       * this is the file React itself loads on the server, and it is empty. The
       * marker keeps doing its real job in the Next build, where the condition
       * is set properly and a query module cannot reach a client bundle.
       *
       * Set here rather than through `resolve.conditions`, which Vitest applies
       * to the client graph and not to the Node one these tests run in.
       *
       * Needed so the paging in lib/queries/transactions.ts can be tested at
       * all. See tests/unit/transaction-paging.spec.ts and F10.
       */
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/unit/**/*.spec.ts"],
    environment: "node",
  },
});
