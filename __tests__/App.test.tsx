/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// App shell smoke test (theme, safe area, keyboard provider, notification gate). The navigator
// pulls in Firebase / AdMob / native modules that don't run under Jest, so it is stubbed here;
// `tsc` type-checks the full navigator tree.
jest.mock('../src/navigation/RootNavigator', () => () => null);
jest.mock('../src/utils/referralLink', () => ({ captureClipboardReferral: () => undefined }));
jest.mock('../src/components/NotificationGate', () => ({ children }: { children: any }) => children);

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
