import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadows } from '../theme/tokens';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Smoothly fade and slide a block into view on mount with optional stagger delay. */
export function FadeSlideIn({
  children,
  delay = 0,
  distance = 14,
  duration = 360,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, duration, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Interactive card wrapper with smooth hover elevation on Web and spring scale press
 * feedback on both touch and pointer devices.
 */
export function InteractiveCard({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;
  const liftY = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);

  /** Animate card to a subtle lifted state when pointer hovers on Web. */
  const handleHoverIn = () => {
    setHovered(true);
    Animated.parallel([
      Animated.spring(liftY, {
        toValue: -4,
        friction: 8,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1.01,
        friction: 8,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  };

  /** Restore resting position when pointer leaves card. */
  const handleHoverOut = () => {
    setHovered(false);
    Animated.parallel([
      Animated.spring(liftY, {
        toValue: 0,
        friction: 8,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  };

  /** Tactile spring compression when pressed down. */
  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.975,
      friction: 7,
      tension: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  /** Spring back when released. */
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: hovered ? 1.01 : 1,
      friction: 7,
      tension: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View
      style={[
        style,
        hovered ? shadows.lifted : shadows.card,
        { transform: [{ translateY: liftY }, { scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        style={styles.fillPressable}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Gentle continuous ambient floating motion used sparingly on hero lookbook visual. */
export function FloatingAmbient({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatY]);

  return (
    <Animated.View style={[style, { transform: [{ translateY: floatY }] }]}>
      {children}
    </Animated.View>
  );
}

/** Smooth pulsing shimmer skeleton block for loading states. */
export function ShimmerBlock({
  height = 20,
  width = '100%',
  borderRadius = radius.sm,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius,
          backgroundColor: colors.surfaceAlt,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** Animated horizontal progress bar smoothly transitioning between 0..1 ratios. */
export function AnimatedProgressTrack({
  progress,
  color = colors.accent,
}: {
  progress: number;
  color?: string;
}): React.ReactElement {
  const anim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, progress]);

  const widthInterpolate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: widthInterpolate, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fillPressable: {
    flex: 1,
  },
  progressTrack: {
    height: 7,
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
