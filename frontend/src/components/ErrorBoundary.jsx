import React from "react";

// Catches a crash inside one part of the page so the rest of SIRAJ keeps working.
//   <ErrorBoundary fallback={null}>...decoration...</ErrorBoundary>   -> a broken decoration just disappears
//   <ErrorBoundary fallback={(reset) => <MyMessage onRetry={reset} />}>   -> custom message with a retry button
//   resetKey={pathname}  -> moving to another page clears the error
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, key: props.resetKey };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // when resetKey changes (e.g. the person opens another page) a failed part gets a fresh try
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { key: props.resetKey, failed: false } : null;
  }

  componentDidCatch(error) {
    if (typeof this.props.onError === "function") this.props.onError(error);
    else if (typeof console !== "undefined") console.warn("SIRAJ: a part of the page failed and was skipped.", error);
  }

  reset() {
    this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback(this.reset);
    return fallback === undefined ? null : fallback;
  }
}
