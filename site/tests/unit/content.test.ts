/** Copy rules from copy deck §1 applied to the content files, plus required slots. */
import { describe, expect, it } from 'vitest';
import home from '../../src/content/en/home.json';
import ui from '../../src/content/en/ui.json';
import { findContentViolations } from '../../scripts/content-rules.mjs';

describe('content', () => {
  it('home.json has every slot the page renders', () => {
    expect(home.hero.headline).toBe('Software, built and run in Dubai.');
    expect(home.hero.subline.length).toBeGreaterThan(0);
    expect(home.statements).toHaveLength(4);
    expect(home.productIndex.items.map((p) => p.name)).toEqual(['QuotesDone', 'Sonobolt', 'MubinFlow']);
  });

  it('footer names the Sole Establishment', () => {
    expect(ui.footer.identity).toContain('Sole Establishment');
  });

  it('no banned words, no L.L.C., no owner-to-confirm markers', () => {
    const text = JSON.stringify([home, ui]);
    expect(findContentViolations(text)).toEqual([]);
  });

  it('the rule set catches what it should', () => {
    expect(findContentViolations('QuotesDone Technologies L.L.C.')).not.toEqual([]);
    expect(findContentViolations('a seamless journey')).toHaveLength(2);
    expect(findContentViolations('[OWNER TO CONFIRM]')).not.toEqual([]);
  });

  it('meta title and description lengths (structure-v1 §4.5)', () => {
    expect(home.meta.title.length).toBeLessThanOrEqual(60);
    expect(home.meta.description.length).toBeGreaterThanOrEqual(110);
    expect(home.meta.description.length).toBeLessThanOrEqual(160);
  });
});
