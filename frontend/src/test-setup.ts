import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
// Unit tests may replace fetch at the transport boundary; actual network fails.
vi.stubGlobal('fetch', () => Promise.reject(new Error('Network disabled in unit tests')));
