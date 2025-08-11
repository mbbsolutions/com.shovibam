import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// --- DESIGN CONSTANTS ---
const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  primary: '#4CC9F0',
  text: '#FFFFFF',
  textMuted: '#B0B0B0',
  border: '#333333',
  button: '#333',
};

const ACCOUNT_COLORS = [
  '#1E3A8A',
  '#1B4332',
  '#5E503F',
  '#4A044E',
  '#8B2C0D',
  '#0A5F7A',
  '#3F3F74',
  '#5C4D7D',
];

const getAccountColor = (accountNumber) => {
  if (!accountNumber) return ACCOUNT_COLORS[0];
  const index = accountNumber
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % ACCOUNT_COLORS.length;
  return ACCOUNT_COLORS[index];
};

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

// --- MAIN COMPONENT ---
const ListDashboardAccounts = ({ isVisible, onClose, onSelectAccount }) => {
  const {
    selectedAccount,
    linkedAccounts,
    saveCurrentSelectedAccount,
    refreshAuthData,
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState(linkedAccounts || []); // Show current data immediately
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Prevent redundant refreshes

  // --- SMART REFRESH: No Flicker, Background Update ---
  useEffect(() => {
    if (!isVisible) {
      // Reset state when modal closes
      setIsInitialLoad(true);
      return;
    }

    const refreshDataInBackground = async () => {
      // ✅ Step 1: Immediately display current accounts (no flicker)
      setAccounts(linkedAccounts || []);

      // ✅ Step 2: Only refresh on first open or if needed
      if (isInitialLoad) {
        setLoading(true);
        try {
          console.log('Account modal: Refreshing data in background...');
          await refreshAuthData(); // Updates context state
          console.log('Account modal: Background refresh complete.');

          // ✅ After refresh, update local accounts from fresh context data
          setAccounts(linkedAccounts || []);
        } catch (error) {
          console.error('Account modal: Background refresh failed:', error);
          // Still keep the cached data
        } finally {
          setLoading(false);
          setIsInitialLoad(false);
        }
      }
    };

    // Debounce or throttle if needed for rapid open/close
    refreshDataInBackground();
  }, [isVisible, linkedAccounts, refreshAuthData, isInitialLoad]);

  // --- HANDLE ACCOUNT SELECTION ---
  const handleAccountSelect = useCallback(
    (account) => {
      console.log('ListDashboardAccounts: Selected account:', account.account_number);
      onSelectAccount(account);
      saveCurrentSelectedAccount();
      onClose();
    },
    [onSelectAccount, onClose, saveCurrentSelectedAccount]
  );

  // --- RENDER ---
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Select Account</Text>
              {selectedAccount?.techvibes_id && (
                <Text style={styles.headerInfoText}>ID: {selectedAccount.techvibes_id}</Text>
              )}
              {selectedAccount?.customer_id && (
                <Text style={styles.headerInfoText}>CustID: {selectedAccount.customer_id}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Subtle Refresh Indicator */}
          {loading && (
            <View style={styles.refreshingIndicator}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.refreshingText}>Updating balances...</Text>
            </View>
          )}

          {/* Account List */}
          <FlatList
            data={accounts}
            keyExtractor={(item) => item.account_number || item.customer_id || Math.random().toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item: account }) => {
              const isSelected = selectedAccount?.account_number === account.account_number;
              const accountColor = getAccountColor(account.account_number);
              const balance = account.balance;

              return (
                <TouchableOpacity
                  style={[
                    styles.accountItem,
                    isSelected && styles.selectedAccountItem,
                    { borderColor: accountColor },
                  ]}
                  onPress={() => handleAccountSelect(account)}
                  activeOpacity={0.7}
                >
                  {/* Account Info */}
                  <View style={styles.accountInfo}>
                    <View style={styles.accountHeader}>
                      <Text style={styles.accountNumber} numberOfLines={1}>
                        {account.account_number}
                      </Text>
                      {account.fintech && (
                        <Text style={[styles.accountType, { color: accountColor, borderColor: accountColor }]}>
                          {account.fintech}
                        </Text>
                      )}
                    </View>

                    <Text style={styles.accountName} numberOfLines={1}>
                      {[
                        account.customer_first_name && account.customer_last_name
                          ? `${account.customer_first_name} ${account.customer_last_name}`
                          : null,
                        account.otherNames && account.lastName
                          ? `${account.otherNames} ${account.lastName}`
                          : null,
                        account.fullName,
                      ].find(Boolean) || 'N/A'}
                    </Text>

                    <View style={styles.balanceContainer}>
                      <Text style={styles.balanceLabel}>Balance:</Text>
                      <Text style={styles.balanceValue}>
                        {balance !== null && balance !== undefined ? (
                          `${account.currency || 'NGN'} ${formatAmount(balance)}`
                        ) : (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        )}
                      </Text>
                    </View>

                    <View style={styles.accountMeta}>
                      {account.bank_name && (
                        <Text style={styles.metaText} numberOfLines={1}>
                          {account.bank_name}
                        </Text>
                      )}
                      <Text style={styles.metaText}>ID: {account.customer_id || 'N/A'}</Text>
                    </View>
                  </View>

                  {/* Radio Button */}
                  <View style={[styles.radioOuter, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={() => (
              <Text style={styles.accountsFoundText}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} found
              </Text>
            )}
          />

          {/* Close Button */}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 5,
  },
  headerInfoText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 16,
  },
  refreshingIndicator: {
    position: 'absolute',
    top: 10,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  refreshingText: {
    color: COLORS.primary,
    fontSize: 12,
    marginLeft: 5,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  selectedAccountItem: {
    backgroundColor: 'rgba(76, 201, 240, 0.15)',
  },
  accountInfo: {
    flex: 1,
    marginRight: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  accountNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  accountType: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  accountName: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginRight: 6,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  accountMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  accountsFoundText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  modalCloseButton: {
    backgroundColor: COLORS.button,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ListDashboardAccounts;