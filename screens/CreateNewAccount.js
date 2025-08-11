import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';

// =================================================================
// 🔗 IMPORT REAL CONTEXT AND SERVICES
// =================================================================
import { useAuth } from '../contexts/AuthContext';
import * as authService from '../services/AuthService';

// =================================================================
// 🔗 MAIN COMPONENT
// =================================================================
const CreateNewAccount = ({ navigation }) => {
  // Replace mock values with real auth context
  const { 
    authUser, 
    selectedAccount, 
    linkedAccounts,
    currentUserTechvibesId,
    userToken
  } = useAuth();

  // Form Fields
  const [newAccountFirstName, setNewAccountFirstName] = useState('');
  const [newAccountLastName, setNewAccountLastName] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountPin, setNewAccountPin] = useState('');
  const [uniqueId, setUniqueId] = useState('');

  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerificationLoading, setOtpVerificationLoading] = useState(false);
  const [otpVerificationMessage, setOtpVerificationMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isEmailVerifiedByOtp, setIsEmailVerifiedByOtp] = useState(false);
  
  // NEW: OTP Resend State
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [canResendOtp, setCanResendOtp] = useState(false);

  // API & Loading States
  const [createAccountLoading, setCreateAccountLoading] = useState(false);
  const [createAccountMessage, setCreateAccountMessage] = useState('');
  const [createAccountApiSentData, setCreateAccountApiSentData] = useState(null);
  const [createAccountApiReceivedData, setCreateAccountApiReceivedData] = useState(null);

  // Add refs for ScrollView and all TextInputs
  const scrollViewRef = useRef(null);
  const emailInputRef = useRef(null);
  const otpInputRef = useRef(null);
  const firstNameInputRef = useRef(null);
  const lastNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const pinInputRef = useRef(null);

  // Function to handle keyboard appearance and scroll to focused input
  const handleKeyboardShow = (event) => {
    // Determine the currently focused input
    const currentlyFocusedInput = TextInput.State.currentlyFocusedInput();
    if (!currentlyFocusedInput) return;
    
    // An array of all refs to check against
    const inputRefs = [
      emailInputRef, otpInputRef, firstNameInputRef, lastNameInputRef,
      phoneInputRef, usernameInputRef, passwordInputRef, pinInputRef,
    ];

    // Find the focused ref
    const focusedRef = inputRefs.find(ref => ref.current === currentlyFocusedInput);

    if (focusedRef && focusedRef.current) {
      const keyboardHeight = event.endCoordinates.height;
      focusedRef.current.measure((x, y, width, height, pageX, pageY) => {
        const inputPosition = pageY + height;
        const screenHeight = Dimensions.get('window').height;
        const scrollPosition = inputPosition - (screenHeight - keyboardHeight) + 50; // +50 for extra padding
        
        if (scrollViewRef.current && scrollPosition > 0) {
          scrollViewRef.current.scrollTo({ y: scrollPosition, animated: true });
        }
      });
    }
  };

  // Add keyboard listeners on mount and remove on unmount
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      handleKeyboardShow
    );
    
    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // Update uniqueId from selected/linked account
  useEffect(() => {
    if (currentUserTechvibesId) {
      setUniqueId(currentUserTechvibesId);
    } else if (selectedAccount?.techvibes_id) {
      setUniqueId(selectedAccount.techvibes_id);
    } else if (linkedAccounts && linkedAccounts.length > 0) {
      setUniqueId(linkedAccounts[0].techvibes_id);
    } else {
      setUniqueId('');
    }
  }, [linkedAccounts, selectedAccount, currentUserTechvibesId]);

  // Cooldown timer logic
  useEffect(() => {
    let timer;
    if (otpResendCooldown > 0) {
      timer = setTimeout(() => {
        setOtpResendCooldown(otpResendCooldown - 1);
      }, 1000);
    } else if (otpSent) {
      setCanResendOtp(true);
    }
    return () => clearTimeout(timer);
  }, [otpResendCooldown, otpSent]);

  // Pre-fill user data
  useEffect(() => {
    if (authUser) {
      setNewAccountFirstName(authUser.first_name || '');
      setNewAccountLastName(authUser.last_name || '');
      setNewAccountEmail(authUser.email || '');
      setNewAccountPhone(authUser.phone || '');
    }
  }, [authUser]);

  // Validate email format
  const isEmailValid = newAccountEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAccountEmail);

  // All required fields filled and email verified
  const areAllRequiredFieldsFilled =
    newAccountFirstName &&
    newAccountLastName &&
    newAccountEmail &&
    newAccountPhone &&
    newAccountUsername &&
    newAccountPassword &&
    newAccountPin &&
    uniqueId &&
    isEmailVerifiedByOtp;

  // 🔹 Send OTP
  const handleSendOtp = async () => {
    setOtpError('');
    setOtpVerificationMessage('');
    setOtpVerificationLoading(true);
    setOtpSent(false);
    setIsEmailVerifiedByOtp(false);
    setCanResendOtp(false);

    if (!isEmailValid) {
      setOtpError('Please enter a valid email address.');
      setOtpVerificationLoading(false);
      return;
    }

    try {
      const res = await authService.sendOtp({ email: newAccountEmail, template: 'otp' });
      if (res.success) {
        setOtpSent(true);
        setOtpVerificationMessage('OTP sent to your email.');
        setOtpResendCooldown(30);
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } else {
        setOtpError(res.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      setOtpError('Network error. Could not send OTP.');
    } finally {
      setOtpVerificationLoading(false);
    }
  };

  // 🔹 Verify OTP
  const handleVerifyOtp = async (code = otpCode) => {
    if (otpVerificationLoading || code.length !== 6) return;

    setOtpError('');
    setOtpVerificationMessage('');
    setOtpVerificationLoading(true);
    
    try {
      const res = await authService.verifyOtp({ 
        email: newAccountEmail, 
        otp: code 
      });
      
      if (res.success) {
        setIsEmailVerifiedByOtp(true);
        setOtpVerificationMessage('✅ Email verified successfully!');
        setOtpError('');
        setTimeout(() => firstNameInputRef.current?.focus(), 100);
      } else {
        setOtpError(res.message || 'OTP verification failed.');
      }
    } catch (err) {
      setOtpError(err.message || 'Network error. Could not verify OTP.');
    } finally {
      setOtpVerificationLoading(false);
    }
  };

  // 🔹 Create Account
  const handleCreateAccount = async () => {
    setCreateAccountMessage('');
    setCreateAccountApiSentData(null);
    setCreateAccountApiReceivedData(null);
    
    if (!uniqueId) {
      setCreateAccountMessage('❌ Error: Missing Techvibes ID. Please log in again.');
      Alert.alert('Error', 'Missing Techvibes ID. Please log in again.');
      return;
    }

    if (!areAllRequiredFieldsFilled) {
      setCreateAccountMessage('Please fill all required fields and verify your email via OTP.');
      Alert.alert('Error', 'Please fill all required fields and verify your email via OTP.');
      return;
    }

    setCreateAccountLoading(true);

    try {
      const formData = new FormData();
      formData.append('first_name', newAccountFirstName);
      formData.append('last_name', newAccountLastName);
      formData.append('email', newAccountEmail);
      formData.append('phone', newAccountPhone);
      formData.append('username', newAccountUsername);
      formData.append('pass', newAccountPassword);
      formData.append('pin', newAccountPin);
      formData.append('techvibes_id', uniqueId);

      if (selectedAccount?.account_number) {
        formData.append('account_number', selectedAccount.account_number);
      }

      setCreateAccountApiSentData({
        url: 'https://techvibs.com/bank/api_general/register_budAccount_api.php',
        method: 'POST',
        body: formData,
      });

      const response = await fetch('https://techvibs.com/bank/api_general/register_budAccount_api.php', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${userToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      setCreateAccountApiReceivedData(JSON.stringify(data, null, 2));

      if (data.status === 'success') {
        setCreateAccountMessage(`✅ Success: ${data.message}`);
        Alert.alert('Account Created', data.message, [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        throw new Error(data.message || 'Failed to create account');
      }
    } catch (error) {
      setCreateAccountMessage(`❌ Error: ${error.message}`);
      setCreateAccountApiReceivedData(`Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setCreateAccountLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Create New Bud Account</Text>
              {uniqueId && (
                <Text style={styles.techvibesId}>Techvibes ID: {uniqueId}</Text>
              )}
            </View>

            {/* Email Input */}
            <Text style={styles.label}>Email (Required)</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textSecondary}
              value={newAccountEmail}
              onChangeText={(text) => {
                setNewAccountEmail(text);
                if (otpSent || isEmailVerifiedByOtp) {
                  setOtpSent(false);
                  setOtpCode('');
                  setIsEmailVerifiedByOtp(false);
                  setOtpVerificationMessage('');
                  setOtpError('');
                  setOtpResendCooldown(0);
                  setCanResendOtp(false);
                }
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!otpVerificationLoading && !createAccountLoading}
              returnKeyType={otpSent ? 'next' : 'done'}
              onSubmitEditing={() => otpSent ? otpInputRef.current?.focus() : Keyboard.dismiss()}
            />

            {/* Send OTP Button */}
            {!otpSent && isEmailValid && !isEmailVerifiedByOtp && (
              <TouchableOpacity
                style={[styles.primaryButton, styles.buttonShadow]}
                onPress={handleSendOtp}
                disabled={otpVerificationLoading}
                activeOpacity={0.7}
              >
                {otpVerificationLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="email" size={18} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Send OTP</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* OTP Input & Verify Button */}
            {otpSent && !isEmailVerifiedByOtp && (
              <>
                <TextInput
                  ref={otpInputRef}
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={COLORS.textSecondary}
                  value={otpCode}
                  onChangeText={(text) => {
                    const cleanedText = text.replace(/[^0-9]/g, '');
                    setOtpCode(cleanedText);
                    if (cleanedText.length === 6) {
                      setTimeout(() => handleVerifyOtp(cleanedText), 50);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!otpVerificationLoading}
                  autoFocus={otpSent}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                />
                {otpVerificationLoading && (
                  <ActivityIndicator 
                    size="small" 
                    color={COLORS.success} 
                    style={styles.autoVerifyIndicator} 
                  />
                )}
                
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    styles.buttonShadow,
                    { opacity: canResendOtp ? 1 : 0.5 },
                  ]}
                  onPress={handleSendOtp}
                  disabled={!canResendOtp || otpVerificationLoading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: COLORS.textSecondary }]}>
                    {canResendOtp ? 'Resend OTP' : `Resend in ${otpResendCooldown}s`}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* OTP Messages */}
            {otpError ? <Text style={[styles.feedback, { color: COLORS.error }]}>{otpError}</Text> : null}
            {otpVerificationMessage ? (
              <Text style={[styles.feedback, { color: COLORS.success }]}>{otpVerificationMessage}</Text>
            ) : null}

            {/* Form Fields (Only after OTP verification) */}
            {isEmailVerifiedByOtp && (
              <>
                <TextInput
                  ref={firstNameInputRef}
                  style={styles.input}
                  placeholder="First Name"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newAccountFirstName}
                  onChangeText={setNewAccountFirstName}
                  autoCapitalize="words"
                  editable={!createAccountLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameInputRef.current?.focus()}
                />
                <TextInput
                  ref={lastNameInputRef}
                  style={styles.input}
                  placeholder="Last Name"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newAccountLastName}
                  onChangeText={setNewAccountLastName}
                  autoCapitalize="words"
                  editable={!createAccountLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneInputRef.current?.focus()}
                />
                <TextInput
                  ref={phoneInputRef}
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newAccountPhone}
                  onChangeText={setNewAccountPhone}
                  keyboardType="phone-pad"
                  editable={!createAccountLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => usernameInputRef.current?.focus()}
                />
                <TextInput
                  ref={usernameInputRef}
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newAccountUsername}
                  onChangeText={setNewAccountUsername}
                  autoCapitalize="none"
                  editable={!createAccountLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newAccountPassword}
                  onChangeText={setNewAccountPassword}
                  secureTextEntry
                  editable={!createAccountLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => pinInputRef.current?.focus()}
                />
                <TextInput
                  ref={pinInputRef}
                  style={styles.input}
                  placeholder="4-digit PIN"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newAccountPin}
                  onChangeText={setNewAccountPin}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={4}
                  editable={!createAccountLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAccount}
                />
              </>
            )}

            {/* Create Account Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.buttonShadow,
                {
                  backgroundColor: createAccountLoading || !areAllRequiredFieldsFilled
                    ? COLORS.buttonDisabled
                    : COLORS.buttonPrimary,
                },
              ]}
              onPress={handleCreateAccount}
              disabled={createAccountLoading || !areAllRequiredFieldsFilled}
              activeOpacity={0.7}
            >
              {createAccountLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="person-add" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.secondaryButton, styles.buttonShadow]}
              onPress={() => navigation.goBack()}
              disabled={createAccountLoading || otpVerificationLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: COLORS.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            {/* Final Message */}
            {createAccountMessage ? (
              <Text style={[styles.feedback, { color: createAccountMessage.includes('✅') ? COLORS.success : COLORS.error }]}>
                {createAccountMessage}
              </Text>
            ) : null}

            {/* Debug Section */}
            <View style={styles.debugBox}>
              <Text style={styles.debugTitle}>🔧 DEBUG INFO</Text>
              <Text selectable style={styles.debugText}>
                Techvibes ID: {uniqueId || 'Not available'}
              </Text>
              {createAccountApiSentData && (
                <Text selectable style={styles.debugText}>
                  {`--- REQUEST ---
${JSON.stringify(createAccountApiSentData, null, 2)}`}
                </Text>
              )}
              {createAccountApiReceivedData && (
                <Text selectable style={styles.debugText}>
                  {`\n--- RESPONSE ---
${createAccountApiReceivedData}`}
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        <GeneralIconsMenuButtons 
          navigation={navigation} 
          active="CreateNewAccount" 
          hide={['Register', 'Login']} 
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

// 🎨 Unified Dark Theme (Matches Settings, History, Otheraccounts)
const COLORS = {
  backgroundPrimary: '#121212',
  cardBackground: '#0A1128',
  accent: '#4CC9F0',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#888888',
  border: 'rgba(255,255,255,0.15)',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#FF5252',
  inputBg: 'rgba(255,255,255,0.08)',
  debugBg: '#1E1E1E',
  debugText: '#B3FFB3',
  buttonPrimary: '#4CC9F0',
  buttonSecondary: '#888',
  buttonDisabled: '#555',
};

// 💅 Styles
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: COLORS.backgroundPrimary,
    paddingBottom: 80,
  },
  
  headerContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: Platform.OS === 'ios' ? 20 : 10,
  },
  techvibesId: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 14,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  buttonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  feedback: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    marginHorizontal: 20,
  },
  debugBox: {
    marginTop: 30,
    backgroundColor: COLORS.debugBg,
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: COLORS.debugText,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  autoVerifyIndicator: {
    marginTop: 10,
    marginBottom: 20,
    alignSelf: 'center',
  },
});

export default CreateNewAccount;