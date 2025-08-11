// screens/LandingPage.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import { 
  getSessionData,
  getMappedUserData,
  getLastChosenAccount,
  getOrCreateDeviceFingerprint,
  checkDeviceMapping
} from '../services/AuthService';

const SPLASH_MIN_DISPLAY_TIME = 2500; // 2.5 seconds fixed display time

export default function LandingPage({ navigation }) {
  const [loadingMessage, setLoadingMessage] = useState('Initializing app...');
  const [splashDelayFinished, setSplashDelayFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  const [appName, setAppName] = useState('');

  // Animations
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Load the app name from allowedFintechs.json
    const allowedFintechs = require('../utils/allowedFintechs.json');
    if (allowedFintechs && allowedFintechs.length > 0) {
      setAppName(allowedFintechs[0]); // Get the first name from the array ("shovibam")
    }
  }, []);

  useEffect(() => {
    // Start the splash screen animation immediately
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();

    // Animate progress bar
    Animated.timing(progressWidth, {
      toValue: 1,
      duration: SPLASH_MIN_DISPLAY_TIME,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Set the fixed 2.5-second delay for the splash screen to be visible
    const fixedDelayTimeout = setTimeout(() => {
      setSplashDelayFinished(true);
      console.log("Splash: Fixed visual delay finished.");
    }, SPLASH_MIN_DISPLAY_TIME);

    // Update progress percentage
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (SPLASH_MIN_DISPLAY_TIME / 100));
        return newProgress > 100 ? 100 : newProgress;
      });
    }, 100);

    return () => {
      clearTimeout(fixedDelayTimeout);
      clearInterval(progressInterval);
    };
  }, [logoScale, logoOpacity, progressWidth]);

  // Effect for handling the actual navigation decision
  useEffect(() => {
    const determineInitialNavigation = async () => {
      if (!splashDelayFinished) return;

      try {
        setLoadingMessage('Checking device...');
        
        // 1. Get device fingerprint
        const fingerprint = await getOrCreateDeviceFingerprint();
        
        // 2. Check if device is mapped to any user
        const mappingResponse = await checkDeviceMapping(fingerprint);
        
        if (mappingResponse.success && mappingResponse.mapped_users) {
          // 3. Get stored session data if available
          const session = await getSessionData();
          
          if (session) {
            // If we have a valid session, go to Home
            setLoadingMessage('Restoring session...');
            navigation.replace('Home');
            return;
          }
          
          // 4. Check for multiple mapped users
          const mappedUsers = await getMappedUserData();
          
          if (mappedUsers.length > 1) {
            // Multiple users - go to account selection
            setLoadingMessage('Multiple accounts found...');
            navigation.replace('AccountSelect');
            return;
          }
          
          if (mappedUsers.length === 1) {
            // Single user - check if we have last chosen account
            const lastAccount = await getLastChosenAccount();
            
            if (lastAccount) {
              // Go directly to login with this account
              setLoadingMessage('Logging in...');
              navigation.replace('Login', { user: lastAccount });
              return;
            }
          }
        }
        
        // Default case - go to login screen
        setLoadingMessage('Starting fresh session...');
        navigation.replace('Login', { user: null });
        
      } catch (error) {
        console.error("Splash navigation error:", error);
        setLoadingMessage('Error. Starting fresh...');
        navigation.replace('Login', { user: null });
      }
    };

    determineInitialNavigation();
  }, [splashDelayFinished, navigation]);

  // Fade in loading text after logo appears
  useEffect(() => {
    Animated.timing(textFade, {
      toValue: 1,
      delay: 500,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [textFade]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity }]}>
        <Animated.Image
          source={require('../assets/logo.png')}
          style={[
            styles.logo,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
          resizeMode="contain"
        />
        <Animated.Text style={[styles.appName, { opacity: textFade }]}>
          {appName || ' '}
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.loadingContainer, { opacity: textFade }]}>
        <ActivityIndicator 
          size="large" 
          color="#4CC9F0" 
          style={styles.indicator} 
        />
        <Animated.Text style={styles.loadingText}>
          {loadingMessage}
        </Animated.Text>
        
        {/* Animated progress bar */}
        <View style={styles.progressBarBackground}>
          <Animated.View 
            style={[
              styles.progressBarFill,
              { 
                width: progressWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }
            ]}
          />
        </View>
        
        <Text style={styles.progressText}>
          {Math.round(progress)}%
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 16,
    borderRadius: 32,
    shadowColor: '#4CC9F0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(76, 201, 240, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    minHeight: 30, // Ensure consistent spacing even when name is loading
  },
  loadingContainer: {
    alignItems: 'center',
    width: '80%',
  },
  indicator: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#4CC9F0',
  },
  progressText: {
    fontSize: 14,
    color: '#4CC9F0',
    fontWeight: '600',
  },
});