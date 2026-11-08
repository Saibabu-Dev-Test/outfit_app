// Web-only fixes for React Native APIs that react-native-web leaves empty.
import { Alert, Share } from 'react-native';

// RN-web's Alert.alert does nothing. Show a small in-page dialog with the same buttons, so every
// message and choice in the app still works (a tap on a dialog button counts as a user tap, which
// the photo picker and Google popup need).
const dark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
Alert.alert = (title, message, buttons, options) => {
  const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  const d = dark();
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,.45);padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  const box = document.createElement('div');
  box.style.cssText =
    'width:100%;max-width:340px;border-radius:16px;padding:20px 20px 8px;box-shadow:0 10px 40px rgba(0,0,0,.3);' +
    (d ? 'background:#1A1724;color:#F2F0FA;' : 'background:#fff;color:#1A1530;');
  if (title) {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-size:17px;font-weight:700;margin-bottom:8px;';
    box.appendChild(h);
  }
  if (message) {
    const m = document.createElement('div');
    m.textContent = message;
    m.style.cssText = 'font-size:14px;line-height:20px;white-space:pre-wrap;opacity:.8;margin-bottom:8px;';
    box.appendChild(m);
  }
  const row = document.createElement('div');
  row.style.cssText =
    'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;margin-top:8px;' +
    (list.length > 2 ? 'flex-direction:column;align-items:stretch;' : '');
  const close = () => overlay.remove();
  list.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.text || 'OK';
    const color = b.style === 'destructive' ? '#E53935' : d ? '#8B7CF6' : '#E91E63';
    btn.style.cssText =
      `background:none;border:0;padding:12px 14px;font-size:15px;font-weight:${b.style === 'cancel' ? 500 : 700};` +
      `color:${color};cursor:pointer;border-radius:10px;text-align:${list.length > 2 ? 'center' : 'right'};`;
    btn.onclick = () => {
      close();
      try {
        b.onPress && b.onPress();
      } catch (e) {
        console.warn('Alert button error:', e && e.message);
      }
    };
    row.appendChild(btn);
  });
  box.appendChild(row);
  overlay.appendChild(box);
  if (!options || options.cancelable !== false) {
    overlay.addEventListener('click', e => {
      if (e.target !== overlay) return;
      close();
      const cancel = list.find(b => b.style === 'cancel');
      if (cancel && cancel.onPress) cancel.onPress();
      if (options && options.onDismiss) options.onDismiss();
    });
  }
  document.body.appendChild(overlay);
  const last = row.lastChild;
  if (last && last.focus) last.focus();
};

// Share: the browser share sheet when there is one (phones), else copy to the clipboard
const originalShare = Share.share;
Share.share = async (content, options) => {
  const nav = window.navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      return await originalShare.call(Share, content, options);
    } catch (e) {
      if (e && e.name === 'AbortError') return { action: Share.dismissedAction };
    }
  }
  const text = [content && content.message, content && content.url].filter(Boolean).join('\n');
  try {
    await nav.clipboard.writeText(text);
    Alert.alert('Copied', 'Paste it in WhatsApp or any app to share.');
  } catch {
    window.prompt('Copy this text to share:', text);
  }
  return { action: Share.sharedAction };
};
