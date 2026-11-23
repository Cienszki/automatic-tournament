import { describe, expect, it } from 'vitest';
import type { Theme } from '@/platform/db/schema/json';
import { themeCssVariables } from './theme';

const theme = (colors: Partial<Theme['colors']> = {}, fonts: Partial<Theme['fonts']> = {}): Theme => ({
  version: 1,
  colors: {
    primary: '#8B1538', secondary: '#D4AF37', accent: '#8B1538', background: 'hsl(240 17% 6%)',
    card: 'hsl(240 15% 10%)', text: 'hsl(0 0% 100%)', mutedText: 'hsl(240 8% 66%)', border: 'hsl(240 16% 20%)',
    ...colors,
  },
  fonts: { header: 'Inter', body: 'Inter', custom: [], ...fonts },
  background: {}, navbar: { style: 'solid' }, card: {}, mode: 'dark', logos: {},
});

describe('themeCssVariables', () => {
  it('names the variables the old site sets, so existing components keep their colours', () => {
    const vars = themeCssVariables(theme());
    expect(vars['--tournament-primary']).toBe('#8B1538');
    expect(vars['--tournament-background']).toBe('hsl(240 17% 6%)');
    expect(vars['--tournament-muted']).toBe('hsl(240 8% 66%)');
  });

  it('falls back to the base colours for the text hierarchy, as the old site does', () => {
    const vars = themeCssVariables(theme());
    expect(vars['--tournament-heading']).toBe('hsl(0 0% 100%)');
    expect(vars['--tournament-secondary-text']).toBe('hsl(240 8% 66%)');
    expect(vars['--tournament-glow']).toBe('#8B1538');
    expect(vars['--tournament-bg-gradient']).toBe('hsl(240 17% 6%)');
  });

  it('uses the gradient and the optional colours when the theme has them', () => {
    const vars = themeCssVariables(theme({ backgroundGradient: 'linear-gradient(135deg, #000 0%, #111 100%)', heading: '#eee' }));
    expect(vars['--tournament-bg-gradient']).toBe('linear-gradient(135deg, #000 0%, #111 100%)');
    expect(vars['--tournament-heading']).toBe('#eee');
  });

  it('drops a value that could break out of the style attribute', () => {
    const vars = themeCssVariables(theme({ primary: 'red; background: url(https://x)', card: '</style>' }));
    expect(vars['--tournament-primary']).toBeUndefined();
    expect(vars['--tournament-card']).toBeUndefined();
    expect(vars['--tournament-glow']).toBeUndefined();
  });

  it('passes fonts that are CSS variables and leaves named fonts to the default', () => {
    const vars = themeCssVariables(theme({}, { header: 'local-oxanium-extrabold', body: 'var(--font-geist-sans)' }));
    expect(vars['--tournament-header-font']).toBeUndefined();
    expect(vars['--tournament-body-font']).toBe('var(--font-geist-sans)');
  });
});
