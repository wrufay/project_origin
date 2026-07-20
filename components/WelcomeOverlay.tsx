import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/theme';

interface WelcomeOverlayProps {
  onDismiss?: () => void;
  hasSeenWelcome?: boolean;
  onWelcomeDismissed?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Logo sizes
const LARGE_LOGO_SIZE = 120;
const MINI_LOGO_SIZE = 50;
const MINI_LOGO_LEFT = 20;
const MINI_LOGO_BOTTOM = 40;

export default function WelcomeOverlay({ onDismiss, hasSeenWelcome, onWelcomeDismissed }: WelcomeOverlayProps) {
  const [animationComplete, setAnimationComplete] = useState(false);

  // Use parent's hasSeenWelcome state, or local state if not provided
  const dismissed = hasSeenWelcome || animationComplete;

  // Animation progress from 0 to 1
  const animProgress = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Starting position (center of screen, above the text bubble)
  const startX = (SCREEN_WIDTH - LARGE_LOGO_SIZE) / 2;
  const startY = (SCREEN_HEIGHT - LARGE_LOGO_SIZE) / 2 - 180; // higher offset to not cover text

  // End position (bottom-left corner)
  const endX = MINI_LOGO_LEFT;
  const endY = SCREEN_HEIGHT - MINI_LOGO_BOTTOM - MINI_LOGO_SIZE;

  // Interpolate position
  const logoLeft = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, endX],
  });
  const logoTop = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, endY],
  });
  const logoSize = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [LARGE_LOGO_SIZE, MINI_LOGO_SIZE],
  });

  const handleDismiss = () => {
    Animated.parallel([
      // Fade out background and text quickly
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Animate logo position and size
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // Can't use native driver for layout props
      }),
    ]).start(() => {
      setAnimationComplete(true);
      onWelcomeDismissed?.();
      onDismiss?.();
    });
  };

  // After dismissal, show only the decorative mini logo
  if (dismissed) {
    return (
      <View style={styles.miniLogoButton}>
        <Image
          source={require('../assets/images/sunny.png')}
          style={styles.miniLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Background overlay - tappable to dismiss */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={handleDismiss}
        activeOpacity={1}
      >
        <Animated.View style={[styles.background, { opacity: fadeAnim }]} />
      </TouchableOpacity>

      {/* Animated Logo - positioned absolutely for smooth animation */}
      <Animated.View
        style={{
          position: 'absolute',
          left: logoLeft,
          top: logoTop,
          width: logoSize,
          height: logoSize,
          zIndex: 60,
        }}
      >
        <Animated.Image
          source={require('../assets/images/sunny.png')}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Text content - fades out */}
      <View style={styles.contentWrapper} pointerEvents="box-none">
        <View style={{ height: LARGE_LOGO_SIZE, marginBottom: 24 }} />
        <Animated.View style={[styles.textContent, { opacity: fadeAnim }]}>
          <View style={styles.textBubble}>
            <Text style={styles.text}>
              HOW TO: Tap the screen (or click headphone button* if in VR mode) to translate current object in frame.
            </Text>
          </View>
          <Text style={styles.tapHint}>Tap anywhere to continue ☺︎</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  background: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  contentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  textBubble: {
    backgroundColor: 'rgba(245, 244, 239, 0.95)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 3,
    borderColor: Colors.orange,
    maxWidth: '90%',
  },
  text: {
    fontSize: 16,
    color: Colors.olive,
    fontFamily: 'Lexend_400Regular',
    lineHeight: 24,
    textAlign: 'center',
  },
  tapHint: {
    marginTop: 24,
    fontSize: 18,
    color: Colors.olive,
    fontFamily: 'NanumPenScript_400Regular',
  },
  miniLogoButton: {
    position: 'absolute',
    left: MINI_LOGO_LEFT,
    bottom: MINI_LOGO_BOTTOM,
    zIndex: 50,
  },
  miniLogo: {
    width: MINI_LOGO_SIZE,
    height: MINI_LOGO_SIZE,
  },
});
