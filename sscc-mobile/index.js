// Canonical Expo entry point.
//
// Importing `expo` runs its side-effect bootstrap (expo/src/Expo.fx), which
// installs Expo's WinterCG runtime globals — including a standards-compliant
// URL (with a writable `protocol`) — BEFORE expo-asset and other Expo modules
// load. That is what prevents the
//   "Cannot assign to property 'protocol' which has only a getter"
// crash in expo-asset's getManifestBaseUrl. No manual URL/DOMException
// polyfills are needed; doing them by hand (or forcing react-native to init
// early via a third-party polyfill) bypasses this ordering and breaks the
// New Architecture event setup.
import { registerRootComponent } from 'expo';

// App-level polyfills (e.g. AbortSignal.timeout). Imported after `expo` so that
// React Native's globals (AbortController/AbortSignal) are already set up.
import './src/polyfills';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and wires up the Expo dev environment for the root component.
registerRootComponent(App);
