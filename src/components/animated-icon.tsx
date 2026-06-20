import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const logoScale = useSharedValue(1.0);
  const glowOpacity = useSharedValue(0);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const startAnimation = useRef(() => {
    SplashScreen.hideAsync().catch(() => {});

    // Aguarda 1 frame para o Reanimated estabilizar antes de animar
    setTimeout(() => {
      logoScale.value = withSequence(
        withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
        withDelay(500, withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) }))
      );
      glowOpacity.value = withSequence(
        withTiming(0.28, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withDelay(550, withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }))
      );
      // 900 + 500 + 450 = 1850ms após o delay
      setTimeout(() => setVisible(false), 1900);
    }, 80);
  }).current;

  if (!visible) return null;

  return (
    <Animated.View style={styles.backgroundSolidColor}>
      <Animated.View style={[styles.iconWrapper, logoStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glowStyle]}>
          <Image
            source={require('@/assets/images/logo-glow.png')}
            style={{ width: 270, height: 270 }}
            contentFit="contain"
          />
        </Animated.View>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={{ width: 240, height: 240 }}
          contentFit="contain"
          allowDownscaling={false}
          onLoad={startAnimation}
        />
      </Animated.View>
    </Animated.View>
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
  iconWrapper: {
    width: 340,
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
