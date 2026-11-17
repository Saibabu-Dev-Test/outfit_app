// Survey wall (CPX Research) / offerwall (Offerwall.GG / BitLabs) inside a WebView. Credits are never
// decided here: the partner's server postback writes the (pending) ledger entry.
// Leaving the wall (Done / back / header arrow) may show ONE interstitial ad before Earn comes back
// (usePostTaskAd, rules in services/postTaskAd.ts): after a task credited since the wall opened, or
// after >= 60 s in the wall when no completion can be seen yet. That ad is owner revenue only and
// gives no coins. The start ad (when a wall is opened) is shown by EarnScreen before it navigates
// here; this screen never shows an ad when it opens.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Text, TouchableOpacity, View } from 'react-native';

// react-native-webview, loaded lazily and guarded like the other native modules: if it is missing
// (tests, a broken native module) the wall opens in the phone's browser instead. Typed loosely:
// webview 13's prop types collapse to `never` with RN 0.87's types; runtime is fine.
type WebViewNavigation = { url: string; canGoBack: boolean };
type WebViewHandle = { goBack: () => void; reload: () => void };
let webViewMod: React.ComponentType<any> | null | undefined;
const getWebView = (): React.ComponentType<any> | null => {
  if (webViewMod !== undefined) return webViewMod;
  try {
    const m = require('react-native-webview');
    webViewMod = (m?.WebView || m?.default || null) as React.ComponentType<any> | null;
  } catch {
    webViewMod = null;
  }
  return webViewMod;
};
import EarnShell from './EarnShell';
import { ui } from './earnUi';
import { useAuth } from '../../context/AuthContext';
import { lastFullscreenAdAt, preloadInterstitial, showInterstitialAd } from '../../native/ads';
import {
  POST_TASK_AD_LOAD_WAIT_MS,
  POST_TASK_AD_TAP_GUARD_MS,
  POST_TASK_CREDIT_CHECK_MS,
} from '../../config/ads';
import { fetchEarningsOnce } from '../../services/earnApi';
import {
  hasNewTaskCredit,
  isPartnerRewardMessage,
  lastPostTaskAdAt,
  needsCreditCheck,
  noteTaskAdShown,
  postTaskAdDecision,
  taskCreditIds,
} from '../../services/postTaskAd';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const within = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), sleep(ms).then(() => fallback)]);

// Preload the post-task ad a little after the wall opens (never shown on open)
const PRELOAD_AFTER_MS = 15000;

// The one post-task ad, run on every way out of the wall (beforeRemove covers Done, the header
// arrow, Android back and swipe-back). Returns the onMessage handler for partner reward messages
// and whether the close is in progress (to show a spinner and stop double taps).
function usePostTaskAd(navigation: any, uid: string) {
  const openedAt = useRef(Date.now());
  const before = useRef<Set<string> | null>(null);
  const rewardSeen = useRef(false);
  const leaving = useRef(false);
  const dispatching = useRef(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchEarningsOnce(uid)
      .then(list => {
        if (alive) before.current = taskCreditIds(list);
      })
      .catch(() => undefined);
    const t = setTimeout(() => preloadInterstitial('earnInterstitial'), PRELOAD_AFTER_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [uid]);

  useEffect(() => {
    const unsub = navigation.addListener?.('beforeRemove', (e: any) => {
      if (dispatching.current) return; // our own pop after the ad
      e.preventDefault();
      if (leaving.current) return; // a second back press while closing: one close, one ad at most
      leaving.current = true;
      setClosing(true);
      (async () => {
        try {
          const closedAt = Date.now();
          const base = { openedAt: openedAt.current, closedAt, lastAdAt: lastFullscreenAdAt(), lastPostTaskAt: lastPostTaskAdAt() };
          let completed = rewardSeen.current;
          if (!completed && needsCreditCheck(base)) {
            completed = await within(
              fetchEarningsOnce(uid).then(after => hasNewTaskCredit({ before: before.current, after, openedAt: openedAt.current })),
              POST_TASK_CREDIT_CHECK_MS,
              false,
            );
          }
          const d = postTaskAdDecision({ ...base, completed });
          if (d.show) {
            await sleep(POST_TASK_AD_TAP_GUARD_MS); // the closing tap can't land on the ad
            const r = await showInterstitialAd('earnInterstitial', POST_TASK_AD_LOAD_WAIT_MS); // no coins, ever
            if (r === 'shown') noteTaskAdShown('completion');
          }
        } catch {
          // never keep the user in the wall because of an ad
        } finally {
          dispatching.current = true;
          navigation.dispatch(e.data.action);
        }
      })();
    });
    return typeof unsub === 'function' ? unsub : undefined;
  }, [navigation, uid]);

  const onMessage = useCallback((ev: any) => {
    if (isPartnerRewardMessage(ev?.nativeEvent?.data)) rewardSeen.current = true;
  }, []);

  return { onMessage, closing };
}

const closingStyle = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center' as const, justifyContent: 'center' as const };
const Closing = () => (
  <View style={closingStyle}>
    <ActivityIndicator size="large" />
  </View>
);

type Params = { url: string; title?: string; kind?: 'survey' | 'offer' };

// Only http(s) pages load inside; app links (market://, intent://, upi://) open outside
const full = { flex: 1 };
const hidden = { flex: 1, display: 'none' as const };

// Forwards the page's window.postMessage events (some partner walls announce a reward this way) to
// onMessage. Read-only: nothing is sent into the page.
const FORWARD_MESSAGES = `(function(){try{window.addEventListener('message',function(e){try{var d=e&&e.data;window.ReactNativeWebView.postMessage(typeof d==='string'?d:JSON.stringify(d));}catch(_){}});}catch(_){}})();true;`;

export const isWebUrl = (u: string) => /^https?:\/\//i.test(u);

export default function EarnWallScreen({ navigation, route }: { navigation: any; route: { params: Params } }) {
  const { url, title } = route.params;
  const { user } = useAuth();
  const { onMessage, closing } = usePostTaskAd(navigation, user?.id || '');
  const ref = useRef<WebViewHandle>(null);
  const canBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Android back: go back inside the wall first
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canBack.current) {
        ref.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const WebView = getWebView();
  if (!WebView) {
    return (
      <EarnShell title={title || 'Earn'} navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>This opens in your browser. Come back here when you are done.</Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 12 }]} onPress={() => Linking.openURL(url).catch(() => undefined)}>
            <Text style={ui.btnText}>Open</Text>
          </TouchableOpacity>
        </View>
        {closing ? <Closing /> : null}
      </EarnShell>
    );
  }

  return (
    <EarnShell
      title={title || 'Earn'}
      navigation={navigation}
      right={
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={closing}>
          <Text style={ui.btnGhostText}>Done</Text>
        </TouchableOpacity>
      }>
      {failed ? (
        <View style={ui.scroll}>
          <Text style={ui.body}>Could not load the page. Please check your internet and try again.</Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 12 }]} onPress={() => { setFailed(false); ref.current?.reload(); }}>
            <Text style={ui.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <WebView
        ref={ref}
        source={{ uri: url }}
        style={failed ? hidden : full}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        originWhitelist={['http://*', 'https://*']}
        onShouldStartLoadWithRequest={(req: WebViewNavigation) => {
          if (isWebUrl(req.url)) return true;
          Linking.openURL(req.url).catch(() => undefined);
          return false;
        }}
        onMessage={onMessage}
        injectedJavaScript={FORWARD_MESSAGES}
        onNavigationStateChange={(s: WebViewNavigation) => (canBack.current = s.canGoBack)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? <ActivityIndicator style={{ position: 'absolute', top: 120, alignSelf: 'center' }} /> : null}
      {closing ? <Closing /> : null}
    </EarnShell>
  );
}
