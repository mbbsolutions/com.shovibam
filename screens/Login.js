import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image, // Import Image for custom icon
  Keyboard,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons'; 
import { useAuth } from '../contexts/AuthContext'; // Corrected import path
import { useNavigation } from '@react-navigation/native';
import Loginicons from '../components/Loginicons';
import {
  fetchUserByIdentifier,
  getDeviceId,
  checkDeviceRegistration,
  sendOtp,
  verifyOtp,
  resendOtp,
  loginWithPassword,
  fetchAllAccountsByTechvibesId,
  mapDevice,
} from '../services/AuthService';
import fintechList from '../utils/allowedFintechs.json';
import logo from '../assets/logo.png';
// Import your custom biometric icon. Make sure to place this image in your assets folder.
import biometricIcon from '../assets/biometric_icon.png'; // Corrected to biometric_icon.png
import { checkBiometricAvailability, authenticateWithBiometrics, storePassword } from '../utils/BiometricService';

const COLOURS = {
  background: '#000000', // Pure black
  card: '#0A1128',
  primary: '#4CC9F0',
  secondary: '#1E1E1E',
  accent: '#4CC9F0',
  text: '#FFFFFF',
  textMuted: '#B0B0B0',
  border: '#22223b',
  shadow: '#000000',
  error: '#FF6B6B',
  success: '#28A745',
};

const LoginScreen = ({ navigation }) => {
  const { setLoginState, isAuthenticating } = useAuth();
  const navigationHook = useNavigation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [messageType, setMessageType] = useState(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugLog, setDebugLog] = useState([]);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isDeviceMapped, setIsDeviceMapped] = useState(false);
  // State for password visibility
  const [showPassword, setShowPassword] = useState(false); 

  // Animated value for biometric button scale
  const biometricScaleValue = useRef(new Animated.Value(1)).current;

  // Declare all refs here at the top of the component
  const scrollRef = useRef(); 
  const identifierInputRef = useRef(null); // <-- Added this declaration
  const otpInputRef = useRef(null); // <-- Added this declaration
  const passwordInputRef = useRef(null); // <-- Added this declaration

  const addDebugLog = (msg, obj) => {
    setDebugLog((prev) => [
      ...prev,
      `[${new Date().toISOString()}] ${msg}${obj ? '\n' + JSON.stringify(obj, null, 2) : ''}`,
    ]);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const fingerprint = await getDeviceId();
        setDeviceFingerprint(fingerprint);
        addDebugLog('Device fingerprint initialized', { fingerprint });
        const checkResult = await checkDeviceRegistration(fingerprint);
        addDebugLog('Device registration check result', checkResult);
        if (checkResult.success && checkResult.mapped_users?.length > 0) {
          setIsDeviceMapped(true);
          const user = checkResult.mapped_users[0];
          setUserData(user);
          setShowPasswordInput(true);
          addDebugLog('User found by device mapping', user);
        } else {
          setIsDeviceMapped(false);
        }
      } catch (error) {
        addDebugLog('Error during device initialization', { error: error.message });
        setIsDeviceMapped(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const checkBiometrics = async () => {
      const { isAvailable } = await checkBiometricAvailability();
      setBiometricAvailable(isAvailable);
    };
    checkBiometrics();
  }, []);

  useEffect(() => {
    let interval;
    if (showOtpInput && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    } else if (otpTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [showOtpInput, otpTimer]);

  useEffect(() => {
    if (otpCode.length === 6) {
      handleVerifyOtp();
    }
  }, [otpCode, handleVerifyOtp]);


  // Keyboard Handling: This useEffect is now mainly for general logging/debugging purposes.
  // The primary scrolling behavior when inputs are focused is handled by the onFocus event on each TextInput.
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        // console.log("Keyboard shown, height:", e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // console.log("Keyboard hidden");
        // No explicit scroll to top here, as paddingBottom ensures visibility.
        // If content is short, it won't scroll anyway.
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);


  const OTP_COOLDOWN_SECONDS = 60;
  const startOtpTimer = () => setOtpTimer(OTP_COOLDOWN_SECONDS);

  const handleFindUser = async () => {
    if (!identifier.trim()) {
      setOtpMessage('Please enter username or account number.');
      setMessageType('error');
      addDebugLog('Identifier empty on search');
      return;
    }
    setIsLoading(true);
    setOtpMessage('');
    try {
      addDebugLog('Searching for user by identifier', { identifier: identifier.trim() });
      const result = await fetchUserByIdentifier(identifier.trim());
      addDebugLog('fetchUserByIdentifier result', result);
      if (result.success && result.user) {
        setUserData(result.user);
        const otpResult = await sendOtp({ email: result.user.email });
        addDebugLog('sendOtp result', otpResult);
        if (otpResult.success) {
          setOtpMessage(`An OTP has been sent to ${result.user.email}`);
          setMessageType('success');
          startOtpTimer();
          setShowOtpInput(true);
        } else {
          setOtpMessage(otpResult.message || 'Failed to send OTP.');
          setMessageType('error');
          setUserData(null);
        }
      } else {
        setUserData(null);
        setOtpMessage(result.message || 'User not found.');
        setMessageType('error');
      }
    } catch (error) {
      setOtpMessage('Failed to connect to server.');
      setMessageType('error');
      addDebugLog('Search error', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = useCallback(async () => {
    if (!otpCode.trim() || !userData?.email) {
      setOtpMessage('Please enter a valid OTP code.');
      setMessageType('error');
      addDebugLog('OTP code missing or user email missing');
      return;
    }
    setIsLoading(true);
    setOtpMessage('');
    try {
      addDebugLog('Verifying OTP', {
        email: userData.email,
        otp: otpCode,
        account_number: userData.account_number,
        username: userData.username,
        phoneNo: userData.phoneNo,
      });
      const verification = await verifyOtp({
        email: userData.email,
        otp: otpCode,
        account_number: userData.account_number,
        username: userData.username,
        phoneNo: userData.phoneNo,
      });
      addDebugLog('OTP Verification Response', verification);
      if (verification.success) {
        setOtpMessage('OTP verified! Enter your password.');
        setMessageType('success');
        setShowOtpInput(false);
        setShowPasswordInput(true);
        setOtpCode('');
      } else {
        setOtpMessage(verification.message || 'Invalid OTP.');
        setMessageType('error');
        setOtpCode('');
      }
    } catch (error) {
      setOtpMessage('Could not verify OTP. Check connection.');
      setMessageType('error');
      addDebugLog('OTP Verification Error', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [otpCode, userData]);

  const handleLogin = async () => {
    if (!password.trim() || !userData) {
      setOtpMessage('Please enter your password.');
      setMessageType('error');
      addDebugLog('Password missing or userData missing');
      return;
    }
    setIsLoading(true);
    setOtpMessage('');
    try {
      addDebugLog('Calling password_and_pin_verify_api.php', { identifier: userData.username, password });
      const result = await loginWithPassword({ identifier: userData.username, password });
      addDebugLog('Password Login API Response', result);
      if (result.success && result.account?.techvibes_id) {
        const deviceFingerprint = await getDeviceId();
        const deviceData = {
          device_fingerprint: deviceFingerprint,
          username: userData.username,
          account_number: userData.account_number,
          account_name: userData.name,
          full_name: userData.name,
          email: userData.email,
          phoneNo: userData.phoneNo,
          techvibes_id: userData.techvibes_id,
          role: userData.role,
          national_identity_no: userData.nin_user_id,
          customer_id: userData.customer_id,
        };
        const mapResult = await mapDevice(deviceData);
        if (mapResult.success) {
          addDebugLog('Device mapped successfully', mapResult);
        } else {
          addDebugLog('Device mapping failed', { error: mapResult.message });
        }
        const passwordStored = await storePassword(userData.username, password);
        if (!passwordStored) {
          addDebugLog('Failed to store password');
        }
        await setLoginState({ userData: result.account, userToken: result.userToken });
        setOtpMessage('Login successful! Redirecting...');
        setMessageType('success');
        navigation.replace('Dashboard');
      } else {
        const errorMsg = result.message || 'Invalid password.';
        setOtpMessage(errorMsg);
        setMessageType('error');
        setPassword('');
        addDebugLog('Login failed', { error: errorMsg });
      }
    } catch (error) {
      addDebugLog('Login failed (catch block)', { error: error.message });
      setOtpMessage('Login failed. Check your internet connection.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0 || isLoading) return;
    setIsLoading(true);
    setOtpMessage('');
    try {
      addDebugLog('Resending OTP', { email: userData.email });
      const result = await resendOtp({ email: userData.email });
      addDebugLog('ResendOtp result', result);
      if (result.success) {
        setOtpMessage(`A new OTP has been sent to ${userData.email}`);
        setMessageType('success');
        startOtpTimer();
      } else {
        setOtpMessage(result.message || 'Failed to resend OTP.');
        setMessageType('error');
      }
    } catch (error) {
      setOtpMessage('Could not resend OTP. Check connection.');
      setMessageType('error');
      addDebugLog('Resend OTP error', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDebugButton = () => {
    setDebugVisible(!debugVisible);
    addDebugLog('Debug button clicked', { debugVisible: !debugVisible });
  };

  const handleCopyDebug = async () => {
    const debugText = debugLog.join('\n\n');
    let success = false;
    try {
      if (Platform.OS === 'web') {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(debugText);
          success = true;
        }
      } else {
        try {
          const ClipboardModule = require('react-native').Clipboard || null;
          if (ClipboardModule && ClipboardModule.setString) {
            ClipboardModule.setString(debugText);
            success = true;
            addDebugLog('Debug log copied to clipboard (RN legacy)');
          } else {
            const fallbackClipboard = require('@react-native-clipboard/clipboard');
            fallbackClipboard.default.setString(debugText);
            success = true;
            addDebugLog('Debug log copied to clipboard (RN fallback)');
          }
        } catch (err) {
          addDebugLog('Failed to copy debug log (RN)', { error: err.message });
        }
      }
    } catch (err) {
      addDebugLog('Failed to copy debug log (catch)', { error: err.message });
    }
    if (!success) {
      addDebugLog('Failed to copy debug log', {});
    }
  };

  const handleBiometricAuth = async () => {
    if (isDeviceMapped && userData) {
      setIsLoading(true);
      setOtpMessage('');
      try {
        const result = await authenticateWithBiometrics('Authenticate to login', userData.username);
        if (result.success) {
          await setLoginState({ userData: result.userData, userToken: result.userToken });
          setOtpMessage('Login successful! Redirecting...');
          setMessageType('success');
          navigation.replace('Dashboard');
        } else {
          setOtpMessage(result.message);
          setMessageType('error');
          addDebugLog('Biometric login failed', { message: result.message, errorType: result.errorType });
        }
      } catch (error) {
        setOtpMessage('Biometric authentication error.');
        setMessageType('error');
        addDebugLog('Biometric auth error', { error: error.message });
      } finally {
        setIsLoading(false);
      }
    } else {
      setOtpMessage('Biometric login only available for mapped devices.');
      setMessageType('error');
    }
  };

  // onPressIn handler for biometric button animation
  const onPressInBiometric = () => {
    Animated.spring(biometricScaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  // onPressOut handler for biometric button animation
  const onPressOutBiometric = () => {
    Animated.spring(biometricScaleValue, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (debugVisible && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [debugLog, debugVisible]);

  const fintechName = fintechList && fintechList.length > 0 ? fintechList[0] : 'Fintech';

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 120 } 
          ]}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.fintechName}>{fintechName}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Sign In</Text>
            <View style={styles.fingerprintContainer}>
              <Text style={styles.fingerprintLabel}>DEVICE ID:</Text>
              <Text style={styles.fingerprintValue} numberOfLines={1} ellipsizeMode="middle">
                {deviceFingerprint} {isDeviceMapped && '(Mapped)'}
              </Text>
            </View>
            <TouchableOpacity style={styles.debugButton} onPress={handleDebugButton}>
              <Text style={styles.debugButtonText}>{debugVisible ? 'Hide Debug Info' : 'Show Debug Info'}</Text>
            </TouchableOpacity>
            {debugVisible && (
              <View style={styles.debugView}>
                <View style={styles.debugHeader}>
                  <Text style={styles.debugTitle}>Debug Log:</Text>
                  <TouchableOpacity style={styles.copyButton} onPress={handleCopyDebug}>
                    <FontAwesome5 name="copy" size={20} color="#fff" />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.debugScroll}
                  showsVerticalScrollIndicator={true}
                  persistentScrollbar={true}
                >
                  {debugLog.length === 0 ? (
                    <Text style={styles.debugEntry}>No debug logs yet...</Text>
                  ) : (
                    debugLog.map((entry, idx) => (
                      <Text key={idx} style={styles.debugEntry}>{entry}</Text>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
            {isDeviceMapped && userData && (
              <View style={styles.userDataContainer}>
                <Text style={[styles.userDataValue, { fontWeight: 'bold', fontSize: 18 }]}>{userData.name}</Text>
                <Text style={styles.userDataValue}>Account: {userData.account_number}</Text>
                <Text style={styles.userDataValue}>Email: {userData.email}</Text>
                <Text style={styles.userDataValue}>ID: {userData.techvibes_id}</Text>
              </View>
            )}
            {!isDeviceMapped && (
              <View style={styles.inputContainer}>
                <TextInput
                  ref={identifierInputRef} 
                  style={styles.input}
                  placeholder="Username or Account Number"
                  placeholderTextColor={COLOURS.textMuted}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  onSubmitEditing={handleFindUser}
                  editable={!isLoading && !isAuthenticating}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollTo({ y: 200, animated: true });
                    }, 100);
                  }}
                />
                <TouchableOpacity
                  style={[styles.searchButton, (isLoading || isAuthenticating) && styles.buttonDisabled]}
                  onPress={handleFindUser}
                  disabled={isLoading || isAuthenticating}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <FontAwesome5 name="search" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            )}
            {!isDeviceMapped && userData && showOtpInput && (
              <View style={styles.otpSection}>
                <TextInput
                  ref={otpInputRef} 
                  style={styles.otpInput}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={COLOURS.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!isLoading}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollTo({ y: 200, animated: true });
                    }, 100);
                  }}
                />
                <View style={styles.resendContainer}>
                  <TouchableOpacity onPress={handleResendOtp} disabled={otpTimer > 0 || isLoading}>
                    <Text style={[styles.resendText, otpTimer > 0 && styles.resendDisabledText]}>
                      {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {(isDeviceMapped || showPasswordInput) && userData && (
              <View>
                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={passwordInputRef} 
                    style={styles.passwordInput}
                    placeholder="Enter Password"
                    placeholderTextColor={COLOURS.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword} 
                    editable={!isLoading}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollRef.current?.scrollTo({ y: 200, animated: true });
                      }, 100);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <FontAwesome5 
                      name={showPassword ? 'eye-slash' : 'eye'} 
                      size={20} 
                      color={COLOURS.textMuted} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.loginIcon}
                    onPress={handleLogin}
                    disabled={isLoading || isAuthenticating}
                  >
                    {isLoading || isAuthenticating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <FontAwesome5 name="sign-in-alt" size={28} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                <Animated.View style={{ transform: [{ scale: biometricScaleValue }] }}>
                  <TouchableOpacity
                    style={[
                      styles.biometricButton,
                      (!biometricAvailable || !isDeviceMapped) && styles.biometricButtonDisabled,
                    ]}
                    onPress={handleBiometricAuth}
                    onPressIn={onPressInBiometric}
                    onPressOut={onPressOutBiometric}
                    disabled={!biometricAvailable || !isDeviceMapped}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Image source={biometricIcon} style={styles.biometricIcon} /> 
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
            {otpMessage ? (
              <View style={[styles.messageContainer, messageType === 'success' ? styles.successMessage : styles.errorMessage]}>
                <Text style={styles.messageText}>{otpMessage}</Text>
              </View>
            ) : null}
          </View>
          {/* Auth links with icons */}
          <View style={styles.authLinksContainer}>
            <TouchableOpacity 
              style={styles.authLink} 
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <FontAwesome5 
                name="key" 
                size={16} 
                color={COLOURS.primary} 
                style={styles.authLinkIcon} 
              />
              <Text style={styles.authLinkText}>Forgot Password?</Text>
            </TouchableOpacity>
            
            <Text style={styles.authLinkSeparator}>|</Text>
            
            <TouchableOpacity 
              style={styles.authLink} 
              onPress={() => navigation.navigate('Register')}
            >
              <FontAwesome5 
                name="user-plus" 
                size={16} 
                color={COLOURS.primary} 
                style={styles.authLinkIcon} 
              />
              <Text style={styles.authLinkText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed footer outside the KeyboardAvoidingView */}
      <View style={styles.footerWrapper}>
        <Loginicons />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOURS.background, 
  },
  scrollContent: {
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingBottom: 120, 
    paddingHorizontal: 10,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 76,
    height: 76,
    marginBottom: 8,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  fintechName: {
    color: COLOURS.primary,
    fontWeight: '700',
    fontSize: 19,
    letterSpacing: 1.1,
    marginBottom: 6,
    textShadowColor: 'rgba(76,201,240,0.17)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  card: {
    backgroundColor: COLOURS.card,
    borderRadius: 12,
    padding: 22,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLOURS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.20,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 28,
    textAlign: 'center',
    color: COLOURS.text,
  },
  fingerprintContainer: {
    backgroundColor: COLOURS.secondary,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLOURS.border,
    ...Platform.select({
      ios: {
        shadowColor: COLOURS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  fingerprintLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLOURS.primary,
    marginBottom: 2,
  },
  fingerprintValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: COLOURS.textMuted,
  },
  debugButton: {
    marginBottom: 12,
    backgroundColor: COLOURS.secondary,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  debugView: {
    backgroundColor: '#22223b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    maxHeight: 200,
    minHeight: 50,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  debugTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOURS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  debugScroll: {
    maxHeight: 140,
  },
  debugEntry: {
    color: '#fff',
    fontSize: 11,
    marginBottom: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 18,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: COLOURS.border,
    paddingHorizontal: 15,
    backgroundColor: COLOURS.secondary,
    color: COLOURS.text,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    fontSize: 16,
  },
  searchButton: {
    height: 48,
    width: 54,
    backgroundColor: COLOURS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  otpSection: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  otpInput: {
    width: '60%',
    height: 48,
    borderWidth: 1,
    borderColor: COLOURS.border,
    paddingHorizontal: 15,
    backgroundColor: COLOURS.secondary,
    color: COLOURS.text,
    borderRadius: 12,
    fontSize: 16,
  },
  passwordContainer: {
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: COLOURS.border,
    backgroundColor: COLOURS.secondary, 
  },
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 15,
    backgroundColor: COLOURS.secondary,
    color: COLOURS.text,
    fontSize: 16,
    paddingRight: 50, // Make space for the eye icon
  },
  eyeIcon: {
    padding: 12,
  },
  biometricButton: {
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: COLOURS.secondary, // Dark background
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
    borderWidth: 2, // Added border width
    borderColor: COLOURS.primary, // Blue border
    ...Platform.select({
      ios: {
        shadowColor: COLOURS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  biometricButtonDisabled: {
    backgroundColor: COLOURS.secondary,
    borderColor: COLOURS.textMuted, // Muted border when disabled
  },
  loginIcon: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: COLOURS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  buttonDisabled: {
    backgroundColor: COLOURS.secondary,
  },
  messageContainer: {
    padding: 13,
    borderRadius: 12,
    marginTop: 18,
    alignItems: 'center',
  },
  successMessage: {
    backgroundColor: '#223c32',
    borderColor: '#43c577',
    borderWidth: 1,
  },
  errorMessage: {
    backgroundColor: '#3b2222',
    borderColor: '#dc3545',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  resendContainer: {
    alignItems: 'flex-end',
    marginBottom: 6,
    width: '60%',
  },
  resendText: {
    color: COLOURS.primary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  resendDisabledText: {
    color: COLOURS.textMuted,
  },
  userDataContainer: {
    backgroundColor: COLOURS.secondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLOURS.border,
  },
  userDataValue: {
    color: COLOURS.text,
    marginBottom: 4,
    fontSize: 15,
  },
  authLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  authLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  authLinkIcon: {
    marginRight: 6,
    width: 16, 
    height: 16, 
    textAlign: 'center', 
  },
  authLinkText: {
    color: COLOURS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  authLinkSeparator: {
    color: COLOURS.textMuted,
    fontSize: 14,
    marginHorizontal: 8, 
  },
  footerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLOURS.background, 
    zIndex: 101, 
  },
  // New style for the custom biometric image icon
  biometricIcon: {
    width: 32, // Adjust the size as necessary
    height: 32, // Adjust the size as necessary
    // No color or textShadow here, as it's part of the image asset
  },
});

export default LoginScreen;
