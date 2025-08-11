// screens/Otheraccounts.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Corrected import path for OTP functions
import { sendOtp, verifyOtp, fetchUserByIdentifier } from '../services/AuthService'; 

import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import { useAuth } from '../contexts/AuthContext';
// ✅ Import the working API function
import { fetchUserAccounts } from '../services/AuthService';

// 🎨 Unified Dark Theme
const COLORS = {
  backgroundPrimary: '#121212',
  cardBackground: '#0A1128',
  accent: '#4CC9F0', // Teal blue
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#888888',
  border: 'rgba(255,255,255,0.15)',
  success: '#4CAF50',
  error: '#FF5252',
  warning: '#FF9800',
  inputBg: 'rgba(255,255,255,0.08)',
  buttonPrimary: '#4CC9F0',
  buttonSecondary: '#888',
  buttonDanger: '#E74C3C',
  modalOverlay: 'rgba(0,0,0,0.6)',
  rowEven: 'rgba(255,255,255,0.05)',
  rowOdd: 'rgba(255,255,255,0.02)',
};

const Otheraccounts = ({ navigation }) => {
  const { linkedAccounts, selectedAccount, isLoadingAuth, updateAllAccounts, authUser } = useAuth();

  // Form & Flow States
  const [step, setStep] = useState(1);
  const [budIdentifier, setBudIdentifier] = useState('');
  const [budCredential, setBudCredential] = useState('');
  const [showCredential, setShowCredential] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [budOtp, setBudOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [removeLoadingId, setRemoveLoadingId] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState({ show: false, account: null });
  const [accountsLoading, setAccountsLoading] = useState(true); // Controls data loading

  // Update uniqueId when selected/linked account changes
  useEffect(() => {
    if (selectedAccount?.techvibes_id) {
      setUniqueId(selectedAccount.techvibes_id);
    } else if (linkedAccounts && linkedAccounts.length > 0) {
      setUniqueId(linkedAccounts[0].techvibes_id);
    } else {
      setUniqueId('');
    }
  }, [linkedAccounts, selectedAccount]);

  // 🔁 Refresh or Load Linked Accounts - Matches ListDashboardAccounts.js
  const refreshAccountsList = useCallback(async () => {
    setAccountsLoading(true);
    try {
      if (authUser?.techvibes_id) {
        console.log('Otheraccounts.js: Fetching accounts for techvibes_id:', authUser.techvibes_id);

        const result = await fetchUserAccounts(authUser.techvibes_id);

        console.log('Fetched accounts data:', {
          success: result.success,
          count: result.accounts?.length,
          techvibes_id: authUser.techvibes_id,
          accounts: result.accounts,
        });

        if (result.success) {
          if (result.accounts && Array.isArray(result.accounts)) {
            console.log('✅ Accounts fetched successfully:', result.accounts.length, 'accounts');
            // Optional: Log first account for structure verification
            if (result.accounts.length > 0) {
              console.log('Sample account structure:', {
                account_number: result.accounts[0].account_number,
                full_name: result.accounts[0].full_name,
                email: result.accounts[0].email,
                source: result.accounts[0].source,
              });
            }

            // Sync with context to ensure state is up to date
            if (updateAllAccounts) {
              await updateAllAccounts();
            }
          } else {
            console.warn('⚠️ Accounts data not in expected format:', result.accounts);
            setErrorMsg('No accounts found or invalid data format.');
          }
        } else {
          console.error('❌ API Error:', result.error || result.message);
          setErrorMsg(result.message || 'Failed to load accounts.');
        }
      } else {
        console.warn('⚠️ No techvibes_id available to fetch accounts.');
        setErrorMsg('User identity not available.');
      }
    } catch (error) {
      console.error('🚨 Network error:', error);
      setErrorMsg('Network error loading accounts. Please check your connection.');
    } finally {
      setAccountsLoading(false);
    }
  }, [authUser?.techvibes_id, updateAllAccounts]);

  // 🚀 Load accounts on component mount
  useEffect(() => {
    console.log('Otheraccounts.js: Component mounted - loading accounts...');
    refreshAccountsList();
  }, [refreshAccountsList]);

  // 🔍 Debug: Log linkedAccounts whenever they change
  useEffect(() => {
    console.log('Current linkedAccounts:', {
      count: linkedAccounts.length,
      accounts: linkedAccounts.map(acc => ({
        account_number: acc.account_number,
        full_name: acc.full_name || acc.accountName,
        email: acc.email || acc.customer_email,
        source: acc.source,
      })),
    });
  }, [linkedAccounts]);

  // 🔐 Validate Credentials (for linking new accounts)
  const handleValidateCredentials = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setAccountInfo(null);
    setOtpRequested(false);
    setOtpVerified(false);

    if (!budIdentifier || !budCredential) {
      setErrorMsg('Please enter your account number/username and password/pin.');
      return;
    }

    setLookupLoading(true);
    try {
      const response = await fetch('https://techvibs.com/bank/api_general/access_account_general_local_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: budIdentifier,
          credential: budCredential,
        }),
      });
      const data = await response.json();
      if (data.success && data.data && data.data.main_account) {
        setAccountInfo(data.data.main_account);
        setSuccessMsg('Account found. Proceed to verification.');
        setErrorMsg('');
        setStep(2);
      } else {
        setErrorMsg(data.message || 'Account not found or invalid credentials.');
      }
    } catch (err) {
      setErrorMsg('Connection error. Please check your network.');
    } finally {
      setLookupLoading(false);
    }
  };

  // 📨 Request OTP
  const handleRequestOtp = async () => {
    if (!accountInfo) {
      setErrorMsg('Account info not loaded. Please check credentials first.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setOtpVerified(false);

    const payload = {
      email: accountInfo.customer_email || accountInfo.email,
      account_number: accountInfo.account_number,
    };

    const res = await sendOtp(payload);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(res.message || 'OTP sent to your email/phone.');
      setOtpRequested(true);
      setErrorMsg('');
    } else {
      setErrorMsg(res.message || res.error || 'Could not send OTP.');
    }
  };

  // ✅ Verify OTP
  const handleVerifyOtp = async (passedOtp) => {
    const otpToVerify = passedOtp !== undefined ? passedOtp : budOtp;
    setErrorMsg('');
    setSuccessMsg('');

    if (!accountInfo) {
      setErrorMsg('Account info not loaded. Please check credentials first.');
      return;
    }
    if (!otpRequested) {
      setErrorMsg('You must request OTP first.');
      return;
    }
    if (!otpToVerify || otpToVerify.length !== 6) {
      setErrorMsg('Enter the 6-digit OTP sent to your email.');
      return;
    }

    setLoading(true);
    const payload = {
      email: accountInfo.customer_email || accountInfo.email,
      otp: otpToVerify,
      account_number: accountInfo.account_number,
    };

    const res = await verifyOtp(payload);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('OTP verified successfully. Account Connected.');
      setOtpVerified(true);
      setShowPopup(true);
      setErrorMsg('');
      refreshAccountsList();
    } else {
      setErrorMsg(res.message || res.error || 'OTP verification failed.');
    }
  };

  const handleBudOtpChange = (text) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
    setBudOtp(digits);
    if (digits.length === 6 && !otpVerified && !loading) {
      handleVerifyOtp(digits);
    }
  };

  const handlePopupOk = () => {
    setShowPopup(false);
    setBudIdentifier('');
    setBudCredential('');
    setBudOtp('');
    setAccountInfo(null);
    setOtpRequested(false);
    setOtpVerified(false);
    setSuccessMsg('');
    setErrorMsg('');
    setStep(1);
    refreshAccountsList();
  };

  const handleRemoveAccount = (account) => {
    setRemoveConfirm({ show: true, account });
  };

  const confirmRemoveAccount = async () => {
    const account = removeConfirm.account;
    setRemoveConfirm({ show: false, account: null });
    setRemoveLoadingId(account.account_number);

    // Simulate API call (replace with real logic)
    const success = await new Promise((resolve) => setTimeout(() => resolve(true), 800));

    if (success) {
      Alert.alert('Success', 'Account disconnected successfully.');
      refreshAccountsList();
    } else {
      Alert.alert('Error', 'Failed to remove account from server. Please try again.');
    }
    setRemoveLoadingId(null);
  };

  // 🔄 Loading State
  if (isLoadingAuth || accountsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading accounts...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GeneralIconsMenuButtons navigation={navigation} active="Otheraccounts" />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={accountsLoading}
            onRefresh={refreshAccountsList}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* Default Account Display */}
        {selectedAccount && (
          <View style={styles.defaultAccountBox}>
            <Text style={styles.defaultAccountText}>
              {selectedAccount.account_number}
              {selectedAccount.full_name && ` • ${selectedAccount.full_name}`}
              {selectedAccount.email && ` • ${selectedAccount.email}`}
              {selectedAccount.techvibes_id && ` • (${selectedAccount.techvibes_id})`}
            </Text>
          </View>
        )}

        {/* Connected Accounts Table */}
        {linkedAccounts.length > 0 ? (
          <View style={styles.tableBox}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableTitle}>Connected Accounts</Text>
              {!!uniqueId && <Text style={styles.uniqueIdLabel}>ID: {uniqueId}</Text>}
              <TouchableOpacity onPress={refreshAccountsList} style={styles.refreshButton}>
                <Icon name="refresh" size={20} color={COLORS.accent} />
              </TouchableOpacity>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.colAccount]}>Account</Text>
              <Text style={[styles.headerCell, styles.colName]}>Name</Text>
              <Text style={[styles.headerCell, styles.colEmail]}>Email</Text>
              <Text style={[styles.headerCell, styles.colAction]}>Action</Text>
            </View>

            {linkedAccounts.map((acc, i) => (
              <View
                key={acc.account_number || acc.customer_id || i}
                style={[
                  styles.tableRow,
                  { backgroundColor: i % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd },
                ]}
              >
                <Text style={[styles.cell, styles.colAccount]}>{acc.account_number || '-'}</Text>
                <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
                  {acc.accountName || acc.full_name || '-'}
                </Text>
                <Text style={[styles.cell, styles.colEmail]} numberOfLines={1}>
                  {acc.email || acc.customer_email || '-'}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveAccount(acc)}
                  disabled={removeLoadingId === acc.account_number || acc.account_number === selectedAccount?.account_number}
                >
                  {removeLoadingId === acc.account_number ? (
                    <ActivityIndicator size="small" color={COLORS.error} />
                  ) : (
                    <Icon name="delete" size={18} color={COLORS.error} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <Icon name="account-multiple" size={48} color={COLORS.textSecondary} />
            <Text style={styles.noAccountsText}>No accounts connected yet</Text>
            <Text style={styles.noAccountsSubtext}>
              Use the form below to link your first account
            </Text>
          </View>
        )}

        {/* Link Account Form */}
        <View style={styles.formCard}>
          {step === 1 && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Account Number or Username"
                placeholderTextColor={COLORS.textSecondary}
                value={budIdentifier}
                onChangeText={setBudIdentifier}
                autoCapitalize="none"
                editable={!lookupLoading}
              />
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Password or PIN"
                  placeholderTextColor={COLORS.textSecondary}
                  value={budCredential}
                  onChangeText={setBudCredential}
                  secureTextEntry={!showCredential}
                  autoCapitalize="none"
                  editable={!lookupLoading}
                />
                <TouchableOpacity onPress={() => setShowCredential((v) => !v)} style={styles.eyeButton}>
                  <Text style={styles.eyeButtonText}>{showCredential ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={lookupLoading}
                onPress={handleValidateCredentials}
              >
                {lookupLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Check Credentials</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === 2 && accountInfo && (
            <>
              <View style={styles.accountSummary}>
                <Text style={styles.summaryLabel}>Account Verified</Text>
                <Text style={styles.summaryText}>Account: {accountInfo.account_number}</Text>
                <Text style={styles.summaryText}>Name: {accountInfo.full_name || '-'}</Text>
                <Text style={styles.summaryText}>Email: {accountInfo.email || '-'}</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={!accountInfo || loading}
                onPress={handleRequestOtp}
              >
                {loading && !otpRequested ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Request OTP</Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={COLORS.textSecondary}
                value={budOtp}
                onChangeText={handleBudOtpChange}
                keyboardType="numeric"
                maxLength={6}
                editable={otpRequested && !otpVerified}
              />

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: otpVerified ? COLORS.success : COLORS.buttonPrimary },
                ]}
                disabled={!otpRequested || loading || budOtp.length !== 6 || otpVerified}
                onPress={handleVerifyOtp}
              >
                <Text style={styles.buttonText}>{otpVerified ? 'Verified' : 'Verify OTP & Connect'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setStep(1);
                  setAccountInfo(null);
                  setOtpRequested(false);
                  setOtpVerified(false);
                  setBudOtp('');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                <Text style={styles.buttonText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {errorMsg ? (
            <Text style={[styles.feedback, { color: COLORS.error }]}>{errorMsg}</Text>
          ) : null}
          {successMsg ? (
            <Text style={[styles.feedback, { color: COLORS.success }]}>{successMsg}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Success Popup */}
      <Modal visible={showPopup} transparent animationType="fade" onRequestClose={handlePopupOk}>
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Icon name="check-circle" size={40} color={COLORS.success} style={styles.popupIcon} />
            <Text style={styles.popupTitle}>Account Connected!</Text>
            <Text style={styles.popupText}>Your account has been successfully linked and verified.</Text>
            {accountInfo && (
              <>
                <Text style={styles.popupDetail}>Account: {accountInfo.account_number}</Text>
                <Text style={styles.popupDetail}>Name: {accountInfo.full_name || '-'}</Text>
                <Text style={styles.popupDetail}>Email: {accountInfo.email || '-'}</Text>
              </>
            )}
            <TouchableOpacity style={styles.popupButton} onPress={handlePopupOk}>
              <Text style={styles.popupButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={removeConfirm.show && !!removeConfirm.account}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveConfirm({ show: false, account: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Icon name="warning" size={40} color={COLORS.warning} style={styles.popupIcon} />
            <Text style={styles.popupTitle}>Remove Account?</Text>
            <Text style={styles.popupText}>Are you sure you want to remove this account?</Text>
            <Text style={styles.popupDetail}>
              <Text style={{ fontWeight: 'bold' }}>Account:</Text> {removeConfirm.account?.account_number}
            </Text>
            {removeConfirm.account?.full_name && (
              <Text style={styles.popupDetail}>
                <Text style={{ fontWeight: 'bold' }}>Name:</Text> {removeConfirm.account.full_name}
              </Text>
            )}
            {removeConfirm.account?.email && (
              <Text style={styles.popupDetail}>
                <Text style={{ fontWeight: 'bold' }}>Email:</Text> {removeConfirm.account.email}
              </Text>
            )}
            <Text style={styles.warningText}>
              Only the <Text style={{ fontWeight: 'bold' }}>techvibes_id</Text> will be cleared.
            </Text>
            <View style={styles.popupButtonRow}>
              <TouchableOpacity
                style={[styles.popupButton, styles.cancelButton]}
                onPress={() => setRemoveConfirm({ show: false, account: null })}
              >
                <Text style={styles.popupButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.popupButton, styles.dangerButton]}
                onPress={confirmRemoveAccount}
              >
                <Text style={styles.popupButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// 💅 Styles
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: COLORS.backgroundPrimary,
    paddingBottom: 80,
  },
  defaultAccountBox: {
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  defaultAccountText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  tableBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.accent,
  },
  uniqueIdLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  refreshButton: {
    padding: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(76, 201, 240, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerCell: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cell: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  colAccount: { flex: 1.5 },
  colName: { flex: 2 },
  colEmail: { flex: 2 },
  colAction: { flex: 1 },
  deleteButton: {
    padding: 6,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noAccountsText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  noAccountsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 24,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 18,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 10,
  },
  eyeButtonText: {
    color: COLORS.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: COLORS.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: COLORS.buttonSecondary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  accountSummary: {
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  feedback: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    padding: 28,
    maxWidth: 340,
    width: '90%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  popupIcon: {
    marginBottom: 12,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  popupText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  popupDetail: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginLeft: 10,
    marginVertical: 2,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.warning,
    textAlign: 'center',
    marginVertical: 10,
  },
  popupButtonRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  popupButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.buttonSecondary,
  },
  dangerButton: {
    backgroundColor: COLORS.buttonDanger,
  },
  popupButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundPrimary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

export default Otheraccounts;
