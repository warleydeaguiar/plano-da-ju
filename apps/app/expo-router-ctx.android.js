// Android ctx shim. require.context("./app", ...) resolves relative to THIS file
// (apps/app/) → correctly finds apps/app/app/ routes.
export const ctx = require.context(
  "./app",
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.ios|\.web)?\.[tj]sx?$/,
  'sync'
);
