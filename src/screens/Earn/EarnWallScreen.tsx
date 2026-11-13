// Survey wall (CPX Research) / offerwall (Offerwall.GG) inside a WebView. Credits are never decided
// here: the partner's server postback writes the (pending) ledger entry; when the user comes back
// the Earn tab sees the new survey entry and asks for one ad before the next survey.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Text, TouchableOpacity, View } from 'react-native';
import { WebView as RNWebView, WebViewNavigation } from 'react-native-webview';

// react-native-webview 13's prop types collapse to `never` with RN 0.87's types (iOS & Android prop
// intersections conflict); runtime is fine, so the component is typed loosely here.
const WebView = RNWebView as unknown as React.ComponentType<any>;
type WebViewHandle = { goBack: () => void; reload: () => void };
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';
import { pauseAppOpenAds } from '../../ads/adsService';

type Params = { url: string; title?: string; kind?: 'survey' | 'offer' };

// Only http(s) pages load inside; app links (market://, intent://, upi://) open outside
const full = { flex: 1 };
const hidden = { flex: 1, display: 'none' as const };

export const isWebUrl = (u: string) => /^https?:\/\//i.test(u);

export default function EarnWallScreen({ navigation, route }: { navigation: any; route: { params: Params } }) {
  const { url, title } = route.params;
  const ref = useRef<WebViewHandle>(null);
  const canBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Partner pages open other apps / browsers: don't show an app-open ad on the way back
  useEffect(() => pauseAppOpenAds(60 * 60 * 1000), []);

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

  return (
    <ScreenShell
      title={title || 'Earn'}
      navigation={navigation}
      right={
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
        onNavigationStateChange={(s: WebViewNavigation) => (canBack.current = s.canGoBack)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? <ActivityIndicator style={{ position: 'absolute', top: 120, alignSelf: 'center' }} /> : null}
    </ScreenShell>
  );
}
