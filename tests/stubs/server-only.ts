// Next.js aliases the real `server-only` package to a no-op when bundling
// for the server and an error-thrower for the client. Outside Next's build
// pipeline (i.e. under Vitest) it always throws, so tests alias it to this
// no-op instead — the client/server safety check still applies to the real
// Next.js build, just not to this test run.
export {};
