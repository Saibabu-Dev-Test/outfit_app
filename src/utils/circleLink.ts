// Circle push deep links: outfit://circle/CIRCLE_ID[/MESSAGE_ID] (pure, unit tested)
export interface CircleLinkTarget {
  circleId: string;
  messageId?: string;
}

export const parseCircleLink = (url: string | null | undefined): CircleLinkTarget | null => {
  const m = url ? /^outfit:\/\/circle\/([A-Za-z0-9_-]{1,64})(?:\/([A-Za-z0-9_-]{1,64}))?\/?$/i.exec(url.trim()) : null;
  return m ? { circleId: m[1], messageId: m[2] || undefined } : null;
};

export const circleLink = (circleId: string, messageId?: string): string =>
  `outfit://circle/${circleId}${messageId ? `/${messageId}` : ''}`;
