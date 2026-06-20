import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const overlayOpacity = useRef(new RNAnimated.Value(1)).current;
  const logoScale = useRef(new RNAnimated.Value(0.5)).current;
  const logoOpacity = useRef(new RNAnimated.Value(0)).current;
  const glowScale = useRef(new RNAnimated.Value(0.7)).current;
  const glowOpacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // 1. Play logo & glow entry spring and fade-in animations
    RNAnimated.parallel([
      RNAnimated.spring(logoScale, {
        toValue: 1.0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      RNAnimated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      RNAnimated.spring(glowScale, {
        toValue: 1.1,
        friction: 6,
        tension: 30,
        useNativeDriver: true,
      }),
      RNAnimated.timing(glowOpacity, {
        toValue: 0.85,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Wait 450ms, then fade out the entire overlay
      setTimeout(() => {
        RNAnimated.timing(overlayOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
        });
      }, 450);
    });
  }, []);

  if (!visible) return null;

  return (
    <RNAnimated.View
      style={[styles.backgroundSolidColor, { opacity: overlayOpacity }]}
    >
      {/* Soft atmospheric blue glow behind the logo */}
      <RNAnimated.View
        style={{
          width: 380,
          height: 380,
          position: 'absolute',
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Image
          source={require('@/assets/images/logo-glow.png')}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      </RNAnimated.View>

      {/* Main Logo */}
      <RNAnimated.View
        style={{
          transform: [{ scale: logoScale }],
          opacity: logoOpacity,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={{ width: 240, height: 240 }}
          contentFit="contain"
        />
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0E1118',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
