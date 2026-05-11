// Default ctx shim (native fallback). require.context("./app", ...) is resolved
// relative to THIS file (apps/app/) → correctly finds apps/app/app/ routes.
export const ctx = require.context(
  "./app",
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*\.[tj]sx?$/,
  'sync'
);
