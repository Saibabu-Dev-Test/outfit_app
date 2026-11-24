// Hospitals tab "Best in India for <disease>" box: disease name in the app language, departments,
// red 108 / 112 notice for red-flag conditions, top 5 NIRF 2025 Medical institutions with the source
// link and the "not a treatment-quality rating" note; nothing for an unknown word.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Linking } from 'react-native';
import BestInIndiaBox from '../src/screens/Civic/BestInIndiaBox';
import { NIRF_SOURCE_URL } from '../src/data/topHospitalsIndia';

const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as any) === 'Text' || (n.type as any)?.displayName === 'Text')
    .map(n => [].concat(n.props.children ?? '').join(''))
    .join('\n');

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
});

describe('BestInIndiaBox', () => {
  it('kidney stone (English): departments, top 5 by NIRF rank, source + note, no emergency', async () => {
    const r = await mount(<BestInIndiaBox lang="English" query="kidney stone" />);
    const txt = textOf(r);
    expect(txt).toMatch(/Best in India for Kidney stone/);
    expect(txt).toMatch(/^Urology$/m);
    expect(txt).toMatch(/^Nephrology$/m);
    expect(txt).toMatch(/#1 All India Institute of Medical Sciences, Delhi/);
    expect(txt).toMatch(/#5 Sanjay Gandhi Postgraduate Institute/);
    expect(txt).not.toMatch(/#6 /);
    expect(txt).toMatch(/NIRF rank 1 · NIRF 2025 Medical rank/);
    expect(txt).toMatch(/not a treatment-quality rating/);
    expect(txt).not.toMatch(/108 or 112/);
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const link = r.root.findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => (c.type as any) === 'Text' && /NIRF rank 1 ·/.test([].concat(c.props.children ?? '').join(''))).length > 0,
    )[0];
    await ReactTestRenderer.act(async () => link.props.onPress());
    expect(spy).toHaveBeenCalledWith(NIRF_SOURCE_URL);
    spy.mockRestore();
  });

  it('Telugu heart pain: Telugu name, emergency notice, Sree Chitra first; same state first', async () => {
    const r = await mount(<BestInIndiaBox lang="Telugu" query="గుండె నొప్పి" state="TG" />);
    const txt = textOf(r);
    expect(txt).toMatch(/గుండె నొప్పి/);
    expect(txt).toMatch(/Heart pain/);
    expect(txt).toMatch(/108/);
    expect(txt).toMatch(/112/);
    expect(txt).toMatch(/#17 Sree Chitra Tirunal/);
    expect(txt.indexOf('#17 ')).toBeLessThan(txt.indexOf('#48 '));
    expect(txt.indexOf('#48 ')).toBeLessThan(txt.indexOf('#1 '));
  });

  it('nothing for an unknown word or an empty box', async () => {
    expect((await mount(<BestInIndiaBox lang="English" query="unknownthing" />)).toJSON()).toBeNull();
    expect((await mount(<BestInIndiaBox lang="English" query="  " />)).toJSON()).toBeNull();
  });
});

describe('GovtRatesBox (inside BestInIndiaBox)', () => {
  it('kidney stone: toggle shows PM-JAY + CGHS rates with tiers and the caveat', async () => {
    const r = await mount(<BestInIndiaBox lang="English" query="kidney stone" />);
    expect(textOf(r)).toMatch(/Govt package rates/);
    expect(textOf(r)).not.toMatch(/PCNL/);
    const toggle = r.root.findAll(
      n => typeof n.props.onPress === 'function' && n.findAll(c => (c.type as any) === 'Text' && /Govt package rates/.test([].concat(c.props.children ?? '').join(''))).length > 0,
    )[0];
    await ReactTestRenderer.act(async () => toggle.props.onPress());
    const txt = textOf(r);
    expect(txt).toMatch(/PCNL \(Percutaneous Nephrolithotomy\)/);
    expect(txt).toMatch(/X ₹56,300 · Y ₹52,700 · Z ₹45,000/);
    expect(txt).toMatch(/PM-JAY HBP 2022/);
    expect(txt).toMatch(/CGHS 2025/);
    expect(txt).toMatch(/Not what every hospital charges/);
  });

  it('Telugu label', async () => {
    const r = await mount(<BestInIndiaBox lang="Telugu" query="kidney stone" />);
    expect(textOf(r)).toMatch(/ప్రభుత్వ ప్యాకేజీ ధరలు/);
  });
});
