/**
 * Vitest global setup — runs before every test file.
 *
 * Using the /vitest subpath so @testing-library/jest-dom augments
 * Vitest's `expect` (not Jest's).  This gives TypeScript proper
 * types for toBeInTheDocument(), toHaveAttribute(), etc.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure DOM is cleaned between tests regardless of globals setting
afterEach(() => {
  cleanup();
});
