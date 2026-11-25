import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
