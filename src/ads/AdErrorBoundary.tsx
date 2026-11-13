// Any render error inside an ad renders nothing instead of crashing the screen
import React from 'react';

export default class AdErrorBoundary extends React.Component<{ children?: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: any) {
    console.warn('Ad render failed:', e?.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
