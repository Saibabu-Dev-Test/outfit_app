// Web build: no WebView; the survey / offer wall opens in a new browser tab.
import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';

export default function EarnWallScreen({ navigation, route }: { navigation: any; route: { params: { url: string; title?: string } } }) {
  const { url, title } = route.params;
  return (
    <ScreenShell title={title || 'Earn'} navigation={navigation}>
      <View style={ui.scroll}>
        <Text style={ui.body}>This opens in a new tab. Come back here when you are done.</Text>
        <TouchableOpacity style={[ui.btn, { marginTop: 12 }]} onPress={() => Linking.openURL(url).catch(() => undefined)}>
          <Text style={ui.btnText}>Open</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}
