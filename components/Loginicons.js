import React, { useState } from 'react';
import { TouchableOpacity, View, StyleSheet, Text, Platform, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock ColourScheme to prevent file not found errors
const ColourScheme = {
  backgroundPrimary: '#0A1128',
  borderLight: 'rgba(76, 201, 240, 0.2)',
  shadowColor: '#000',
  textLight: '#FFFFFF',
};

// Mock Haptics object to prevent module resolution errors
const Haptics = {
  impactAsync: (style) => {
    // Mock function
  },
  ImpactFeedbackStyle: {
    Light: 'light'
  }
};

const themeColors = {
  iconFetchUser: "#1976D2",
  iconSendOtp: "#4CAF50",
  iconShop: "#e67e22",
  iconPOS: "#2ecc71",
};

const DEFAULT_ICON_SIZE = 24;

// Icon for fetching user data
export const FetchUserIcon = ({ size = DEFAULT_ICON_SIZE }) => (
  <View style={styles.singleIconWrapper}>
    <Icon name="account-search" size={size} color={themeColors.iconFetchUser} />
    <Text style={styles.iconText}>Fetch User</Text>
  </View>
);

// Icon for sending OTP
export const SendOtpIcon = ({ size = DEFAULT_ICON_SIZE }) => (
  <View style={styles.singleIconWrapper}>
    <Icon name="email-send" size={size} color={themeColors.iconSendOtp} />
    <Text style={styles.iconText}>Send OTP</Text>
  </View>
);

// Updated POS icon with press animation and glow effect
export const PosIcon = ({ size = DEFAULT_ICON_SIZE, navigation, isActive = false }) => {
  const scaleValue = useState(new Animated.Value(1))[0];

  const onPressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isActive) {
      navigation.navigate('POS');
    }
  };

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isActive}
    >
      <Animated.View style={[
        styles.iconWrapper,
        isActive && styles.activeIconWrapper,
        { transform: [{ scale: scaleValue }] }
      ]}>
        <Icon
          name="point-of-sale"
          size={size}
          color={themeColors.iconPOS}
          style={{
            textShadowColor: 'rgba(46, 204, 113, 0.7)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 10
          }}
        />
        <Text style={styles.iconText}>POS</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Updated Shop icon (previously Retail) with press animation and glow effect
export const ShopIcon = ({ size = DEFAULT_ICON_SIZE, navigation, isActive = false }) => {
  const scaleValue = useState(new Animated.Value(1))[0];

  const onPressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isActive) {
      navigation.navigate('Shop');
    }
  };

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isActive}
    >
      <Animated.View style={[
        styles.iconWrapper,
        isActive && styles.activeIconWrapper,
        { transform: [{ scale: scaleValue }] }
      ]}>
        <Icon
          name="shopping"
          size={size}
          color={themeColors.iconShop}
          style={{
            textShadowColor: 'rgba(230, 126, 34, 0.7)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 10
          }}
        />
        <Text style={styles.iconText}>Shop</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Updated footer with the new ShopIcon
export const LoginActionIcons = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <ShopIcon navigation={navigation} />
      <PosIcon navigation={navigation} />
    </View>
  );
};

// Main component for switching icon sets in LoginScreen
const LoginIcons = ({ iconSet }) => {
  switch (iconSet) {
    case 'fetchUser':
      return <FetchUserIcon />;
    case 'sendOtp':
      return <SendOtpIcon />;
    default:
      return <LoginActionIcons />;
  }
};

const styles = StyleSheet.create({
  footer: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: ColourScheme.backgroundPrimary,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: ColourScheme.borderLight,
    zIndex: 100,
    width: '100%',
    shadowColor: ColourScheme.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
    flex: 1,
    marginHorizontal: 5,
    maxWidth: 120,
    minHeight: 60,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(76, 201, 240, 0.3)',
    borderWidth: 1,
    borderColor: '#4CC9F0',
  },
  singleIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
    flexDirection: 'column',
  },
  iconText: {
    fontSize: 12,
    marginTop: 4,
    color: ColourScheme.textLight,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default LoginIcons;
