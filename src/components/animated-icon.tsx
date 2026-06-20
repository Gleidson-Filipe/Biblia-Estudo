import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useRef, useState } from 'react';
import { Animated as RNAnimated, Dimensions, Easing as RNEasing, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const overlayOpacity = useRef(new RNAnimated.Value(1)).current;
  const logoScale = useRef(new RNAnimated.Value(1.0)).current;
  const glowOpacity = useRef(new RNAnimated.Value(0)).current;

  const startAnimation = useRef(() => {
    // Dispara o fade-out nativo (250ms no Kotlin), e só inicia a animação RN
    // após o nativo ter sumido completamente — sem sobreposição de ícones.
    SplashScreen.hideAsync().catch(() => {});
    RNAnimated.parallel([
      RNAnimated.timing(logoScale, {
        toValue: 1.15,
        duration: 900,
        easing: RNEasing.inOut(RNEasing.cubic),
        useNativeDriver: true,
      }),
      RNAnimated.timing(glowOpacity, {
        toValue: 0.28,
        duration: 800,
        easing: RNEasing.inOut(RNEasing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        RNAnimated.parallel([
          RNAnimated.timing(overlayOpacity, {
            toValue: 0,
            duration: 450,
            easing: RNEasing.inOut(RNEasing.quad),
            useNativeDriver: true,
          }),
          RNAnimated.timing(logoScale, {
            toValue: 0,
            duration: 450,
            easing: RNEasing.in(RNEasing.cubic),
            useNativeDriver: true,
          }),
          RNAnimated.timing(glowOpacity, {
            toValue: 0,
            duration: 380,
            easing: RNEasing.in(RNEasing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => setVisible(false));
      }, 500);
    });
  }).current;

  if (!visible) return null;

  return (
    <RNAnimated.View style={[styles.backgroundSolidColor, { opacity: overlayOpacity }]}>
      <RNAnimated.View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          opacity: glowOpacity,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/images/logo-glow.png')}
          style={{ width: 260, height: 260 }}
          contentFit="contain"
        />
      </RNAnimated.View>

      <RNAnimated.View
        style={{
          transform: [{ scale: logoScale }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={{ width: 240, height: 240 }}
          contentFit="contain"
          allowDownscaling={false}
          onLoad={startAnimation}
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
