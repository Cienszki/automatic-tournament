import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  configureErrorReporting,
  reportError,
  reportComponentError,
} from '@/lib/error-reporting';

describe('error-reporting', () => {
  let mockProvider: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockProvider = vi.fn();
    configureErrorReporting(mockProvider);
  });

  describe('reportError', () => {
    it('sends Error instance to provider with message and stack', () => {
      const err = new Error('test failure');
      reportError(err);

      expect(mockProvider).toHaveBeenCalledOnce();
      const report = mockProvider.mock.calls[0][0];
      expect(report.message).toBe('test failure');
      expect(report.stack).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    it('converts non-Error values to Error', () => {
      reportError('string error');

      const report = mockProvider.mock.calls[0][0];
      expect(report.message).toBe('string error');
    });

    it('includes extra context', () => {
      reportError(new Error('oops'), { userId: '123', page: '/test' });

      const report = mockProvider.mock.calls[0][0];
      expect(report.context).toEqual({ userId: '123', page: '/test' });
    });
  });

  describe('reportComponentError', () => {
    it('includes component stack and section info', () => {
      const err = new Error('render error');
      reportComponentError(err, '<App>\n  <Page>', { section: 'dashboard' });

      expect(mockProvider).toHaveBeenCalledOnce();
      const report = mockProvider.mock.calls[0][0];
      expect(report.message).toBe('render error');
      expect(report.componentStack).toBe('<App>\n  <Page>');
      expect(report.context).toEqual({ section: 'dashboard' });
    });
  });

  describe('configureErrorReporting', () => {
    it('allows swapping the provider', () => {
      const provider1 = vi.fn();
      const provider2 = vi.fn();

      configureErrorReporting(provider1);
      reportError(new Error('first'));
      expect(provider1).toHaveBeenCalledOnce();

      configureErrorReporting(provider2);
      reportError(new Error('second'));
      expect(provider2).toHaveBeenCalledOnce();
      expect(provider1).toHaveBeenCalledOnce(); // not called again
    });
  });
});
