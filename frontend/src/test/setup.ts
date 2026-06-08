/**
 * Vitest global setup — runs before every test file.
 *
 * Using the /vitest subpath so @testing-library/jest-dom augments
 * Vitest's `expect` (not Jest's).  This gives TypeScript proper
 * types for toBeInTheDocument(), toHaveAttribute(), etc.
 */
import "@testing-library/jest-dom/vitest";
