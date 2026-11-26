// HeadlineCard (civic lists): bold headline + 2-line summary in two distinct theme colours, details on tap.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import HeadlineCard, { HEADLINE_MAX, shortHeadline } from '../src/components/HeadlineCard';
import { darkColors, lightColors } from '../src/theme/colors';
import { applyPalette } from '../src/theme/themeState';
import { CIVIC_LABELS } from '../src/i18n/civicLabels';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
const mount = async (el: React.ReactElement) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(el);
  });
  mounted.push(r);
  return r;
};
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(r => r.unmount());
  });
  applyPalette(false);
});

const isText = (n: ReactTestRenderer.ReactTestInstance) => (n.type as any) === 'Text' || (n.type as any)?.displayName === 'Text';
const textIn = (n: ReactTestRenderer.ReactTestInstance) => [].concat(n.props.children ?? '').join('');
const allText = (r: ReactTestRenderer.ReactTestRenderer) => r.root.findAll(isText).map(textIn).join('\n');
const byId = (r: ReactTestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id && typeof n.type !== 'string');
const firstText = (r: ReactTestRenderer.ReactTestRenderer, id: string) => byId(r, id)[0].findAll(isText)[0];
const colorOf = (n: ReactTestRenderer.ReactTestInstance) => StyleSheet.flatten(n.props.style).color;
const toggle = async (r: ReactTestRenderer.ReactTestRenderer) => {
  const t = byId(r, 'headline-toggle').find(n => typeof n.props.onPress === 'function');
  await ReactTestRenderer.act(async () => t!.props.onPress());
};

// WCAG contrast ratio of two #RRGGBB colours
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const fact = 'The pension was raised from Rs 3,000 to Rs 4,000 a month for all eligible old-age pensioners in the state.';

describe('HeadlineCard', () => {
  it('shows a bold headline and a 2-line summary in two distinct colours; details open on tap', async () => {
    const r = await mount(
      <HeadlineCard lang="English" headline="Old-age pension Rs 4,000 a month" summary={fact}>
        <Text>🔗 example.gov.in · 📅 2024-07-01</Text>
      </HeadlineCard>,
    );
    const h = firstText(r, 'headline-title');
    const s = firstText(r, 'headline-summary');
    expect(textIn(h)).toBe('Old-age pension Rs 4,000 a month');
    expect(textIn(s)).toBe(fact);
    expect(StyleSheet.flatten(h.props.style).fontWeight).toBe('800');
    expect(colorOf(h)).toBe(lightColors.civicHeadline);
    expect(colorOf(s)).toBe(lightColors.civicSummary);
    expect(colorOf(h)).not.toBe(colorOf(s));
    expect(s.props.numberOfLines).toBe(2);
    expect(allText(r)).toMatch(/Tap for details/);
    expect(allText(r)).not.toMatch(/example\.gov\.in/);
    expect(byId(r, 'headline-details')).toHaveLength(0);

    await toggle(r);
    expect(allText(r)).toMatch(/example\.gov\.in · 📅 2024-07-01/);
    expect(allText(r)).toMatch(/Hide details/);
    expect(firstText(r, 'headline-summary').props.numberOfLines).toBeUndefined();

    await toggle(r);
    expect(allText(r)).not.toMatch(/example\.gov\.in/);
  });

  it('cuts a long headline to ~60 chars with … and shows it in full when opened', async () => {
    const long = 'Free bus travel for all women in state-run buses across every district from the first year';
    expect(shortHeadline(long).length).toBeLessThanOrEqual(HEADLINE_MAX);
    expect(shortHeadline(long)).toMatch(/…$/);
    expect(shortHeadline('Short title')).toBe('Short title');
    const r = await mount(<HeadlineCard lang="English" headline={long} />);
    expect(textIn(firstText(r, 'headline-title'))).toBe(shortHeadline(long));
    await toggle(r);
    expect(textIn(firstText(r, 'headline-title'))).toBe(long);
  });

  it('no summary field = nothing extra (no placeholder, no toggle when there is nothing more)', async () => {
    const r = await mount(<HeadlineCard lang="English" headline="District Collectorate" summary="" />);
    expect(byId(r, 'headline-summary')).toHaveLength(0);
    expect(new Set(allText(r).split('\n'))).toEqual(new Set(['District Collectorate']));
    expect(allText(r)).not.toMatch(/Tap for details|Public info/);
  });

  it('dark theme uses the dark tokens; both palettes keep the two colours distinct and readable (AA)', async () => {
    [lightColors, darkColors].forEach(p => {
      expect(p.civicHeadline).not.toBe(p.civicSummary);
      expect(contrast(p.civicHeadline, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.civicSummary, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.civicHeadline, p.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.civicSummary, p.background)).toBeGreaterThanOrEqual(4.5);
    });
    applyPalette(true);
    const r = await mount(<HeadlineCard lang="English" headline="GGH Kurnool" summary="Government · Hospital Rd, Kurnool" />);
    expect(colorOf(firstText(r, 'headline-title'))).toBe(darkColors.civicHeadline);
    expect(colorOf(firstText(r, 'headline-summary'))).toBe(darkColors.civicSummary);
  });

  it('translated headline + summary with the English line; "Tap for details" in Telugu and Hindi', async () => {
    const r = await mount(<HeadlineCard lang="Telugu" headline="Pension" headlineTr="పింఛను" summary="Raised to Rs 4,000" summaryTr="రూ.4,000కి పెంపు" />);
    const txt = allText(r);
    expect(txt).toMatch(/పింఛను/);
    expect(txt).toMatch(/Pension/);
    expect(txt).toMatch(/రూ\.4,000కి పెంపు/);
    expect(txt).toMatch(new RegExp(CIVIC_LABELS.Telugu.tapDetails));
    (['Telugu', 'Hindi'] as const).forEach(l => {
      expect(CIVIC_LABELS[l].tapDetails).toBeTruthy();
      expect(CIVIC_LABELS[l].tapDetails).not.toBe(CIVIC_LABELS.English.tapDetails);
      expect(CIVIC_LABELS[l].hideDetails).not.toBe(CIVIC_LABELS.English.hideDetails);
    });
  });
});
