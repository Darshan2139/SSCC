// App-level polyfills for standard web APIs that Hermes / React Native does not
// implement and that Expo's winter runtime does not provide.
//
// Unlike URL / Event (handled by Expo's bootstrap — do NOT polyfill those by
// hand), AbortSignal.timeout() is a genuinely missing API. React Native sets up
// the AbortController / AbortSignal globals via setUpXHR, so we only need to add
// the missing static helper used for fetch request timeouts, e.g.
//   fetch(url, { signal: AbortSignal.timeout(8000) })

if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = function timeout(ms) {
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort(
        typeof DOMException !== 'undefined'
          ? new DOMException('The operation timed out.', 'TimeoutError')
          : new Error('The operation timed out.')
      );
    }, ms);
    return controller.signal;
  };
}
