import { circleLink, parseCircleLink } from '../src/utils/circleLink';

describe('circle deep links', () => {
  it('parses circle and message ids', () => {
    expect(parseCircleLink('outfit://circle/abc_12/msg-9')).toEqual({ circleId: 'abc_12', messageId: 'msg-9' });
    expect(parseCircleLink('outfit://circle/abc')).toEqual({ circleId: 'abc', messageId: undefined });
  });
  it('ignores other links', () => {
    expect(parseCircleLink('outfit://join/CODE')).toBeNull();
    expect(parseCircleLink('https://example.com/circle/abc')).toBeNull();
    expect(parseCircleLink('outfit://circle/../x')).toBeNull();
    expect(parseCircleLink(null)).toBeNull();
    expect(parseCircleLink('')).toBeNull();
  });
  it('round-trips', () => {
    expect(parseCircleLink(circleLink('c1', 'm1'))).toEqual({ circleId: 'c1', messageId: 'm1' });
    expect(parseCircleLink(circleLink('c1'))).toEqual({ circleId: 'c1', messageId: undefined });
  });
});
