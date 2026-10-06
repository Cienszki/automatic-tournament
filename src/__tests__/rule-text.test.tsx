import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RuleText } from '@/components/rules/RuleText';

describe('RuleText', () => {
  it('renders formatting, safe external links and lists', () => {
    const { container } = render(
      <RuleText
        content={'**Ważne:** dołącz na [Discord](https://discord.gg/x) i *przeczytaj*\n- jeden\n- dwa\n\n<script>alert(1)</script>'}
        linkColor="#ff0000"
      />
    );
    expect(container.querySelector('strong')?.textContent).toBe('Ważne:');
    expect(container.querySelector('em')?.textContent).toBe('przeczytaj');

    const link = container.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://discord.gg/x');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.style.color).toBe('rgb(255, 0, 0)');

    expect([...container.querySelectorAll('ul li')].map(li => li.textContent)).toEqual(['jeden', 'dwa']);
    // Raw HTML is shown as text, never injected
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('keeps line breaks and opens site-relative links in the same tab', () => {
    const { container } = render(<RuleText content={'Punktacja:\nWygrana → 2 pkt\n[harmonogram](/pdl-s2/schedule)'} />);
    expect(container.querySelectorAll('br')).toHaveLength(2);
    expect(container.querySelector('a')?.getAttribute('target')).toBeNull();
  });
});
