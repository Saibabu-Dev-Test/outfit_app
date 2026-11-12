// Any error inside an ad renders nothing instead of taking the screen (or the app) down.
import React from 'react';

export default class AdErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: any) {
    console.warn('Ad crashed (hidden):', e?.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
