import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount every rendered React tree after each test to prevent leakage.
afterEach(() => cleanup());
