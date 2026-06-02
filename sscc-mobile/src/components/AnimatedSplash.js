import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from '../theme';

// Animated brand splash for SSCC (Smart Stabilizer Controller).
// Design: a lightning-bolt badge with two pulsing "sonar" rings (evoking a live
// signal / voltage being stabilized), brand text rising in, and a sweep loading
// bar. Sits as a full-screen overlay over the app and fades out when finished.
export default function AnimatedSplash({ onDone }) {
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoSpin = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(16)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Reveal our JS splash by dismissing the native one.
    SplashScreen.hideAsync().catch(() => {});

    const makePulse = (val, delay) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration: 2000,
          delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
    const pulse1 = makePulse(ring1, 0);
    const pulse2 = makePulse(ring2, 1000);
    pulse1.start();
    pulse2.start();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(logoSpin, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(subOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(barProgress, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.delay(220),
    ]).start(() => {
      Animated.timing(screenOpacity, { toValue: 0, duration: 420, useNativeDriver: true }).start(() => {
        pulse1.stop();
        pulse2.stop();
        onDone && onDone();
      });
    });
  }, []);

  const ringStyle = (val) => ({
    opacity: val.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.85, 2.6] }) }],
  });

  const spin = logoSpin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.ring, ringStyle(ring1)]} />
          <Animated.View style={[styles.ring, ringStyle(ring2)]} />
          <Animated.View
            style={[
              styles.logo,
              { opacity: logoOpacity, transform: [{ scale: logoScale }, { rotate: spin }] },
            ]}
          >
            <Feather name="zap" size={46} color="#fff" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          SSCC
        </Animated.Text>
        <Animated.Text style={[styles.sub, { opacity: subOpacity }]}>
          Smart Stabilizer Controller
        </Animated.Text>

        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              { width: barProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </View>

      <Animated.Text style={[styles.footer, { opacity: subOpacity }]}>Powering up…</Animated.Text>
    </Animated.View>
  );
}

const LOGO = 96;
const RING = 130;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  logoWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.text1,
  },
  sub: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text3,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  barTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 30,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text3,
    letterSpacing: 0.5,
  },
});
