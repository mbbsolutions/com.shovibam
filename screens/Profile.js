import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// === DARK THEME COLORS ===
const COLORS = {
  backgroundPrimary: '#121212', // Main background
  cardBackground: '#0A1128',   // Cards & modals
  accent: '#4CC9F0',           // Teal accent
  textPrimary: '#FFFFFF',      // White text
  textSecondary: '#B0B0B0',    // Light grey
  border: 'rgba(255,255,255,0.15)',
  error: '#FF5252',
  success: '#4CAF50',
  buttonBg: '#4CC9F0',
  buttonText: '#121212',
};

// Helper: Format numbers with commas
const formatAmount = (value) => {
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
    const num = parseFloat(value);
    return num.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value;
};

export default function ProfileScreen({ navigation }) {
  const { selectedAccount, linkedAccounts, setSelectedAccount, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [isAccountSelectionModalVisible, setIsAccountSelectionModalVisible] = useState(false);

  useEffect(() => {
    const loadProfileData = async () => {
      if (isLoadingAuth) {
        setLoading(true);
        return;
      }
      setLoading(false);
      setError(null);
      if (selectedAccount && Object.keys(selectedAccount).length > 0) {
        setProfileData(selectedAccount);
        console.log("ProfileScreen: Loaded profile data from AuthContext.selectedAccount:", selectedAccount);
      } else {
        setError("No user data found. Please ensure you are logged in and an account is selected.");
        setProfileData(null);
        console.warn("ProfileScreen: No selected account found in AuthContext.");
      }
    };
    loadProfileData();
  }, [selectedAccount, isLoadingAuth]);

  // Helper: Safely get display values
  const getDisplayValue = (key) => {
    const value =
      profileData?.[key] ||
      profileData?.[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] ||
      profileData?.[key.toLowerCase()] ||
      'N/A';

    if (key === 'balance' && (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value))))) {
      return formatAmount(value);
    }
    return String(value);
  };

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    setIsAccountSelectionModalVisible(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Title with Icon */}
        <View style={styles.titleContainer}>
          <Icon name="account-circle-outline" size={30} color={COLORS.accent} />
          <Text style={styles.title}>My Profile</Text>
        </View>

        {/* Account Summary */}
        <View style={styles.accountSummaryContainer}>
          <Text style={styles.accountCountText}>
            Connected Accounts: {linkedAccounts ? linkedAccounts.length : 0}
          </Text>
          {linkedAccounts && linkedAccounts.length > 1 && (
            <TouchableOpacity
              style={styles.switchAccountButton}
              onPress={() => setIsAccountSelectionModalVisible(true)}
            >
              <Icon name="swap-horizontal" size={18} color={COLORS.buttonText} />
              <Text style={styles.switchAccountButtonText}>Switch Account</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : profileData ? (
          <View style={styles.profileCard}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Full Name:</Text>
              <Text style={styles.dataValue}>
                {getDisplayValue('customer_first_name')} {getDisplayValue('customer_last_name')}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Username:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('username')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Email:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('email')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Phone Number:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('phoneNo')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Account Name:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('account_name')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Account Number:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('account_number')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Balance:</Text>
              <Text style={styles.dataValue}>
                {getDisplayValue('currency')} {getDisplayValue('balance')}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Account Status:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('account_status')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Techvibes ID:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('techvibes_id')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Customer ID:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('customer_id')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Fintech:</Text>
              <Text style={styles.dataValue}>{getDisplayValue('fintech')}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noDataText}>No profile data available.</Text>
        )}
      </ScrollView>

      {/* Account Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isAccountSelectionModalVisible}
        onRequestClose={() => setIsAccountSelectionModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAccountSelectionModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Account</Text>
            <ScrollView style={styles.accountListScroll}>
              {linkedAccounts?.map((account, index) => (
                <TouchableOpacity
                  key={account.account_number || index}
                  style={[
                    styles.accountListItem,
                    selectedAccount?.account_number === account.account_number && styles.selectedAccountListItem,
                  ]}
                  onPress={() => handleAccountSelect(account)}
                >
                  <View>
                    <Text style={styles.accountListItemName}>{account.account_name || 'N/A'}</Text>
                    <Text style={styles.accountListItemNumber}>{account.account_number || 'N/A'}</Text>
                    <Text style={styles.accountListItemBalance}>
                      {account.currency || 'NGN'} {formatAmount(account.balance)}
                    </Text>
                  </View>
                  {selectedAccount?.account_number === account.account_number && (
                    <Icon name="check-circle" size={20} color={COLORS.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsAccountSelectionModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Bottom Navigation */}
      <GeneralIconsMenuButtons navigation={navigation} active="Profile" />
    </View>
  );
}

// === STYLES ===
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 30 : 50,
    backgroundColor: COLORS.backgroundPrimary,
    paddingBottom: 80,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  accountSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 450,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  accountCountText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  switchAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  switchAccountButtonText: {
    color: COLORS.buttonText,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 20,
  },
  noDataText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 50,
  },
  profileCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dataLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
    flex: 1,
    textAlign: 'left',
    paddingRight: 10,
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: 'right',
    paddingLeft: 10,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 350,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 15,
  },
  accountListScroll: {
    maxHeight: 300,
  },
  accountListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  selectedAccountListItem: {
    backgroundColor: 'rgba(76, 201, 240, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderStyle: 'solid',
  },
  accountListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  accountListItemNumber: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  accountListItemBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
    marginTop: 5,
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});