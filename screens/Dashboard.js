import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import ColourScheme from '../styles/ColourSchemeStyles';
import { DataPurchaseIcon, AirtimePurchaseIcon, BillPaymentIcon, LoanIcon } from '../components/DashboardIcons';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import ListDashboardAccounts from '../components/ListDashboardAccounts';
import DashboardHistory from '../components/DashboardHistory';
import Cards from '../components/Cards';

// Utility to format currency amounts
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

export default function Dashboard({ route }) {
  const navigation = useNavigation();
  const {
    authUser,
    selectedAccount,
    linkedAccounts,
    isLoadingAuth,
    isAuthenticated,
    setSelectedAccount,
    lastSelectedAccountNumber,
    currentUserTechvibesId,
    loadLastSelectedAccount,
    debugStorage,
    refreshAuthData,
  } = useAuth();

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [latestBalance, setLatestBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Debug log: Monitor all relevant state changes
  useEffect(() => {
    console.log('DASHBOARD STATE LOG:');
    console.log('isLoadingAuth:', isLoadingAuth);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('authUser:', authUser ? { techvibes_id: authUser.techvibes_id, name: authUser.name } : 'null');
    console.log('selectedAccount:', selectedAccount ? {
      account_number: selectedAccount.account_number,
      customer_id: selectedAccount.customer_id,
      balance: selectedAccount.balance
    } : 'null');
    console.log('linkedAccounts count:', linkedAccounts?.length || 0);
    console.log('lastSelectedAccountNumber:', lastSelectedAccountNumber);
    console.log('currentUserTechvibesId:', currentUserTechvibesId);
  }, [
    isLoadingAuth,
    isAuthenticated,
    authUser,
    selectedAccount,
    linkedAccounts,
    lastSelectedAccountNumber,
    currentUserTechvibesId
  ]);

  // Initialize selected account from lastSelectedAccountNumber
useEffect(() => {
  const initializeAccount = async () => {
    if (!isLoadingAuth && isAuthenticated && linkedAccounts?.length > 0) {
      console.log('Initializing account selection...');
      let accountToSelect = null;
      // Try to restore last selected account
      if (lastSelectedAccountNumber) {
        accountToSelect = linkedAccounts.find(acc => acc.account_number === lastSelectedAccountNumber);
        if (!accountToSelect) {
          console.log('Trying to manually load last selected account');
          await loadLastSelectedAccount();
          accountToSelect = linkedAccounts.find(acc => acc.account_number === lastSelectedAccountNumber);
        }
        if (accountToSelect) {
          console.log('Restored from last selected:', accountToSelect.account_number);
        }
      }
      // Fallback to first account
      if (!accountToSelect && linkedAccounts.length > 0) {
        accountToSelect = linkedAccounts[0];
        console.log('No last selected account, using first:', accountToSelect.account_number);
      }
      // Only update if different
      if (accountToSelect && (!selectedAccount ||
          accountToSelect.account_number !== selectedAccount.account_number)) {
        console.log('Setting selected account:', accountToSelect.account_number);
        setSelectedAccount(accountToSelect);
      }
    }
  };

  initializeAccount();
}, [isLoadingAuth, isAuthenticated, linkedAccounts, lastSelectedAccountNumber, loadLastSelectedAccount, setSelectedAccount, selectedAccount]);


  // Update latestBalance and timestamp when selectedAccount changes
useEffect(() => {
  if (selectedAccount && selectedAccount.balance !== undefined && selectedAccount.balance !== null) {
    const balance = parseFloat(selectedAccount.balance);
    if (!isNaN(balance)) {
      setLatestBalance(balance);
      setLastUpdated(new Date());
      console.log("Dashboard: Updated balance to", balance, "at", new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    } else {
      console.warn("Dashboard: Invalid balance value received:", selectedAccount.balance);
      setLatestBalance(null);
    }
  } else {
    setLatestBalance(null);
    console.log("Dashboard: Balance not available or undefined");
  }
}, [selectedAccount]);


  // Pull-to-Refresh Handler
  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('Dashboard: Pull-to-refresh initiated. Calling refreshAuthData...');
      if (refreshAuthData) {
        const updatedAccount = await refreshAuthData();
        if (updatedAccount) {
          console.log('Dashboard: Auth data refreshed successfully. New balance:', updatedAccount.balance);
        } else {
          console.warn('Dashboard: No account data returned from refresh');
        }
      } else {
        console.warn('Dashboard: refreshAuthData function not available in useAuth. Cannot refresh.');
      }
    } catch (error) {
      console.error("Dashboard: Error during pull-to-refresh:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthData]);

  // Account Selection
  const handleAccountSelect = useCallback((account) => {
    console.log('Dashboard: Manually switching to account:', account.account_number);
    setSelectedAccount(account);
    setShowAccountModal(false);
  }, [setSelectedAccount]);

  // Loading State
  if (isLoadingAuth || !isAuthenticated || !selectedAccount) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CC9F0" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // Main Render
  return (
    <View style={styles.appBackground}>
      <GeneralIconsMenuButtons navigation={navigation} active="Dashboard" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullToRefresh}
            colors={['#4CC9F0']}
            tintColor="#4CC9F0"
          />
        }
        showsVerticalScrollIndicator={true}
      >
        {/* Main Account Card */}
        <View style={styles.mainCard}>
          <View style={styles.topRowHeader}>
            <TouchableOpacity
              onPress={() => setShowAccountModal(true)}
              style={styles.accountNumberWrapper}
              activeOpacity={0.7}
            >
              <Text style={styles.accountNumberText}>
                {selectedAccount?.account_number}
                {selectedAccount?.techvibes_id && (
                  <Text style={styles.techvibesIdText}> ({selectedAccount.techvibes_id})</Text>
                )}
                {linkedAccounts.length > 1 && <Text style={styles.dropdownArrow}> ▼</Text>}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomInfoSection}>
            <Text style={styles.accountHolderName}>
              {selectedAccount?.customer_first_name || selectedAccount?.otherNames || 'N/A'}{' '}
              {selectedAccount?.customer_last_name || selectedAccount?.lastName || ''}
            </Text>
            <Text style={styles.headerBalanceDisplay}>
              Bal: {latestBalance !== null ? (
                <>
                  {selectedAccount?.currency || 'NGN'} {formatAmount(latestBalance)}
                  {refreshing && <Text style={styles.refreshingText}> • Refreshing...</Text>}
                </>
              ) : (
                <ActivityIndicator size="small" color="#4CC9F0" />
              )}
            </Text>
            <Text style={styles.compactText}>
              Customer ID: {selectedAccount?.customer_id || 'N/A'}
            </Text>
            {lastUpdated && (
              <Text style={styles.compactText}>
  Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'N/A'}
</Text>

            )}
          </View>
        </View>

        {/* Quick Action Icons */}
        <View style={styles.dashboardIconsContainer}>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => {
              console.log('Navigating to Transfer screen...');
              navigation.navigate('Transfer');
            }}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>➤</Text>
            </View>
            <Text style={styles.iconLabel}>Send</Text>
          </TouchableOpacity>
          <DataPurchaseIcon size={30} color={ColourScheme.iconData} user={selectedAccount} />
          <AirtimePurchaseIcon size={30} color={ColourScheme.iconAirtime} user={selectedAccount} />
          <BillPaymentIcon size={30} color={ColourScheme.iconBill} user={selectedAccount} />
          <LoanIcon size={30} color={ColourScheme.iconLoan} user={selectedAccount} />
        </View>

        <View style={styles.cardsContainer}>
          <Cards />
        </View>

        {selectedAccount?.customer_id && (
          <View style={styles.historyContainer}>
            <DashboardHistory
              customerId={selectedAccount.customer_id}
              accountNumber={selectedAccount.account_number}
              navigation={navigation}
            />
          </View>
        )}
      </ScrollView>

      {/* Account Modal */}
      <ListDashboardAccounts
        isVisible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onSelectAccount={handleAccountSelect}
      />

      {/* Debug Button */}
      <TouchableOpacity
        onPress={debugStorage}
        style={styles.debugButton}
      >
        <Text style={styles.debugButtonText}>Debug Storage</Text>
      </TouchableOpacity>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  appBackground: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 30 : 50,
    alignItems: 'center',
    paddingBottom: 100,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#FFFFFF',
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
  topRowHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  accountNumberWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  techvibesIdText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginLeft: 6,
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#FFFFFF',
    marginLeft: 6,
  },
  bottomInfoSection: {
    paddingTop: 16,
  },
  accountHolderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'right',
  },
  headerBalanceDisplay: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4CC9F0',
    marginBottom: 10,
    textAlign: 'right',
  },
  refreshingText: {
    color: '#4CC9F0',
    fontSize: 12,
    marginLeft: 5,
  },
  compactText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'right',
  },
  dashboardIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#0A1128',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  actionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(76, 201, 240, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconText: {
    fontSize: 24,
    color: ColourScheme.iconTransfer,
  },
  iconLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  cardsContainer: {
    backgroundColor: '#0A1128',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  historyContainer: {
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
  },
  debugButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    padding: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});
