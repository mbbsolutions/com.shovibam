import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import ColourScheme from '../styles/ColourSchemeStyles';
import { requestOTP, verifyOTP, resetCredential } from '../utils/passwordReset';

export default function PasswordPinResetScreen() {
  const navigation = useNavigation();
  const [type, setType] = useState('password');
  const [userIdentifier, setUserIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [otherCredential, setOtherCredential] = useState('');
  const [step, setStep] = useState(1);
  const [resultMessage, setResultMessage] = useState('');
  const [otpResultMessage, setOtpResultMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [pageNotification, setPageNotification] = useState({ message: '', type: '' });

  const showPageNotification = (message, type = 'info') => {
    setPageNotification({ message, type });
  };

  const handleRequestOTP = async () => {
    if (!userIdentifier) {
      showPageNotification('Please enter your Account Number or Username.', 'error');
      return;
    }
    setLoading(true);
    setResultMessage('');
    setOtpResultMessage('');
    setDebugInfo(`Payload for requestOTP: { type: "${type}", user_identifier: "${userIdentifier}" }`);
    try {
      const response = await requestOTP(type, userIdentifier);
      setResultMessage(response.message);
      if (response.success) {
        setStep(2);
        showPageNotification('OTP sent to your email.', 'success');
      } else {
        showPageNotification(`Failed to request OTP: ${response.message}`, 'error');
      }
    } catch (error) {
      setResultMessage(`Error: ${error.message}`);
      showPageNotification(`Failed to connect to the server: ${error.message}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!userIdentifier || !otp) {
      showPageNotification('Please enter both Account Number/Username and OTP.', 'error');
      return;
    }
    setLoading(true);
    setOtpResultMessage('');
    setDebugInfo(`Payload for verifyOTP: { type: "${type}", user_identifier: "${userIdentifier}", otp: "${otp}" }`);
    try {
      const response = await verifyOTP(type, userIdentifier, otp);
      if (response.success) {
        setOtpResultMessage('OTP verified successfully!');
        setStep(3);
        showPageNotification('OTP verified successfully!', 'success');
      } else {
        setOtpResultMessage(`OTP verification failed: ${response.message || 'Invalid OTP'}`);
        showPageNotification(`OTP verification failed: ${response.message || 'Invalid OTP'}`, 'error');
      }
    } catch (error) {
      setOtpResultMessage(`Error: ${error.message}`);
      showPageNotification(`Failed to connect to the server: ${error.message}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetCredential = async () => {
    if (!userIdentifier || !otp || !newCredential || !otherCredential) {
      showPageNotification('Please fill in all fields.', 'error');
      return;
    }
    if (type === 'password') {
      const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordPattern.test(newCredential)) {
        showPageNotification('Password must be at least 8 characters, include uppercase, lowercase, a number, and a special character.', 'error');
        return;
      }
    }
    setLoading(true);
    setResultMessage('');
    setDebugInfo(`Payload for resetCredential: { type: "${type}", user_identifier: "${userIdentifier}", otp: "********", new_credential: "********", other_credential: "********" }`);
    try {
      const response = await resetCredential(type, userIdentifier, otp, newCredential, otherCredential);
      setResultMessage(`Result: ${JSON.stringify(response, null, 2)}`);
      if (response.success) {
        showPageNotification(`${type === 'password' ? 'Password' : 'PIN'} updated successfully.`, 'success');
        setStep(1);
        setUserIdentifier('');
        setOtp('');
        setNewCredential('');
        setOtherCredential('');
        setOtpResultMessage('');
      } else {
        showPageNotification(`Reset failed: ${response.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      setResultMessage(`Error: ${error.message}`);
      showPageNotification(`Failed to connect to the server: ${error.message}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.appBackground}>
      <KeyboardAvoidingView
        style={styles.avoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.mainCard}>
            {pageNotification.message ? (
              <View
                style={[
                  styles.pageNotification,
                  pageNotification.type === 'success' ? styles.pageNotificationSuccess : styles.pageNotificationError,
                ]}
              >
                <Text style={styles.pageNotificationText}>{pageNotification.message}</Text>
              </View>
            ) : null}

            <Text style={styles.title}>Reset Password/PIN</Text>

            <Text style={styles.label}>Reset Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={type}
                onValueChange={setType}
                style={styles.picker}
                enabled={!loading && step === 1}
              >
                <Picker.Item label="Password" value="password" />
                <Picker.Item label="PIN" value="pin" />
              </Picker>
            </View>

            <Text style={styles.label}>Account Number or Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter account number or username"
              placeholderTextColor={ColourScheme.textMuted}
              value={userIdentifier}
              onChangeText={setUserIdentifier}
              autoCapitalize="none"
              keyboardType="default"
              editable={!loading && step === 1}
            />
            {step === 1 && (
              <TouchableOpacity style={styles.button} onPress={handleRequestOTP} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Request OTP</Text>
                )}
              </TouchableOpacity>
            )}

            {(step === 2 || step === 3) && (
              <View style={styles.stepContainer}>
                <Text style={styles.label}>OTP</Text>
                <View style={styles.otpContainer}>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={ColourScheme.textMuted}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!loading && step === 2}
                  />
                  {step === 2 && (
                    <TouchableOpacity style={styles.otpButton} onPress={handleVerifyOTP} disabled={loading}>
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Verify OTP</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {otpResultMessage ? (
                  <Text
                    style={[
                      styles.message,
                      otpResultMessage.includes('successfully') ? styles.success : styles.error,
                    ]}
                  >
                    {otpResultMessage}
                  </Text>
                ) : null}
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={styles.label}>New {type === 'password' ? 'Password' : 'PIN'}</Text>
                <View style={styles.passwordToggleContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={`Enter new ${type}`}
                    placeholderTextColor={ColourScheme.textMuted}
                    value={newCredential}
                    onChangeText={setNewCredential}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    keyboardType={type === 'pin' ? 'numeric' : 'default'}
                    maxLength={type === 'pin' ? 6 : undefined}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.showHideButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.showHideButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {type === 'password' && (
                  <Text style={styles.passwordHint}>
                    Password must be at least 8 characters, include uppercase, lowercase, a number, and a special character.
                  </Text>
                )}
                <Text style={styles.label}>{type === 'password' ? 'Current PIN' : 'Current Password'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Enter current ${type === 'password' ? 'PIN' : 'password'}`}
                  placeholderTextColor={ColourScheme.textMuted}
                  value={otherCredential}
                  onChangeText={setOtherCredential}
                  secureTextEntry={type === 'password'}
                  autoCapitalize="none"
                  keyboardType={type === 'password' ? 'numeric' : 'default'}
                  maxLength={type === 'password' ? 6 : undefined}
                  editable={!loading}
                />
                <TouchableOpacity style={styles.button} onPress={handleResetCredential} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Reset {type === 'password' ? 'Password' : 'PIN'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {resultMessage ? (
              <Text style={[styles.result, resultMessage.includes('Error') ? styles.error : styles.success]}>
                {resultMessage}
              </Text>
            ) : null}

            {debugInfo ? (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info</Text>
                <Text style={styles.debugText}>{debugInfo}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.iconContainer}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Login')}
              accessibilityLabel="Back to Login"
            >
              <Icon name="login" size={28} color={ColourScheme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Register"
            >
              <Icon name="person-add" size={28} color={ColourScheme.primary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appBackground: {
    flex: 1,
    backgroundColor: '#121212',
  },
  avoidingContainer: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 30 : 50,
    alignItems: 'center',
    paddingBottom: 100,
    flexGrow: 1,
  },
  mainCard: {
    backgroundColor: '#0A1128',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  pageNotification: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNotificationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pageNotificationSuccess: {
    backgroundColor: '#223c32',
    borderColor: '#43c577',
    borderWidth: 1,
  },
  pageNotificationError: {
    backgroundColor: '#3b2222',
    borderColor: '#dc3545',
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0B0B0',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#1E1E1E',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    marginBottom: 10,
  },
  picker: {
    width: '100%',
    height: 50,
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#4CC9F0',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  result: {
    marginTop: 18,
    padding: 10,
    borderRadius: 8,
    fontSize: 15,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  debugContainer: {
    marginTop: 18,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#B0B0B0',
    fontFamily: 'monospace',
  },
  stepContainer: {
    marginTop: 10,
  },
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpInput: {
    flex: 1,
  },
  otpButton: {
    backgroundColor: '#4CC9F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  success: {
    color: '#43c577',
  },
  error: {
    color: '#dc3545',
  },
  passwordToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
  },
  showHideButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 4,
  },
  showHideButtonText: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  passwordHint: {
    fontSize: 12,
    color: '#B0B0B0',
    marginTop: 4,
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#121212',
  },
  iconButton: {
    marginHorizontal: 20,
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
  },
});