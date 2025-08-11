import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth to call logout

// Color Palette
const COLORS = {
  backgroundPrimary: '#121212',
  cardBackground: '#0A1128',
  accent: '#4CC9F0',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  border: 'rgba(255,255,255,0.15)',
  error: '#FF5252',
  success: '#4CAF50',
};

const Settings = ({ navigation }) => {
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const scaleValue = useRef(new Animated.Value(1)).current;
  const { logout } = useAuth(); // Access logout from AuthContext

  useEffect(() => {
    setFeedback('');
    setFeedbackType('');
  }, []);

  const openDeviceSettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.openSettings();
      } catch (error) {
        Alert.alert('Error', 'Unable to open device settings.');
      }
    } else {
      Alert.alert(
        'Open Settings',
        'Please go to the Settings app > Face ID & Passcode to enroll biometrics.'
      );
    }
  };

  // Logout function
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (result.success) {
              setFeedback('Logout successful.');
              setFeedbackType('success');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              setFeedback(result.message);
              setFeedbackType('error');
            }
          },
        },
      ]
    );
  };

  // Menu data with optional section grouping
  const settingsSections = [
    {
      title: 'Account Settings',
      items: [
        {
          id: 'reset-credentials',
          label: 'Reset Credentials',
          icon: 'lock-reset',
          onPress: () => navigation.navigate('ForgotPasswordScreen'),
        },
        {
          id: 'delete-card',
          label: 'Delete Card',
          icon: 'credit-card-remove-outline',
          onPress: () => Alert.alert('Delete Card', 'This will trigger the Delete Card workflow.'),
        },
        {
          id: 'logout',
          label: 'Logout',
          icon: 'logout',
          onPress: handleLogout,
        },
      ],
    },
    {
      title: 'Device Management',
      items: [
        {
          id: 'update-device',
          label: 'Update Device',
          icon: 'cellphone-arrow-down',
          onPress: () => Alert.alert('Update Device', 'This will trigger the Update Device workflow.'),
        },
        {
          id: 'delete-device',
          label: 'Delete Device',
          icon: 'cellphone-remove',
          onPress: () => Alert.alert('Delete Device', 'This will trigger the Delete Device workflow.'),
        },
        {
          id: 'freeze-account',
          label: 'Freeze Account',
          icon: 'snowflake',
          onPress: () => Alert.alert('Freeze Account', 'This will freeze the account for 24–72 hours.'),
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          id: 'setup-biometrics',
          label: 'Setup Biometrics',
          icon: 'fingerprint',
          onPress: openDeviceSettings,
          subtitle: 'Add fingerprint or Face ID on this device.',
        },
      ],
    },
  ];

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.98,
      friction: 20,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 20,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <GeneralIconsMenuButtons navigation={navigation} active="Settings" />

      <Text style={styles.title}>Settings</Text>

      {settingsSections.map((section, index) => (
        <React.Fragment key={section.title}>
          {index > 0 && (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          <Animated.View
            style={[
              styles.menuList,
              index === 0 && { marginTop: 0 },
            ]}
          >
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.7}
                accessibilityLabel={item.label}
                accessibilityRole="button"
              >
                <Animated.View
                  style={{
                    transform: [{ scale: scaleValue }],
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  <Icon
                    name={item.icon}
                    size={22}
                    color={COLORS.accent}
                    style={styles.icon}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuItemText}>{item.label}</Text>
                    {item.subtitle && (
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  <Icon
                    name="chevron-right"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </React.Fragment>
      ))}

      {/* Feedback Box with Icon */}
      {feedback ? (
        <View
          style={[
            styles.feedbackBox,
            feedbackType === 'success'
              ? styles.successBox
              : styles.errorBox,
          ]}
        >
          <Icon
            name={feedbackType === 'success' ? 'check-circle' : 'alert-circle'}
            size={20}
            color={feedbackType === 'success' ? COLORS.success : COLORS.error}
            style={styles.feedbackIcon}
          />
          <Text
            style={{
              color: feedbackType === 'success' ? COLORS.success : COLORS.error,
            }}
          >
            {feedback}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: COLORS.backgroundPrimary,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionHeader: {
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 16,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuList: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  feedbackBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackIcon: {
    marginRight: 8,
  },
  successBox: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: COLORS.success,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderColor: COLORS.error,
  },
});

export default Settings;