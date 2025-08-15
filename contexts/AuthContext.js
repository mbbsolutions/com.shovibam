import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAllAccountsByTechvibesId } from '../services/AuthService';
import { useEmailService } from '../utils/emailService'; // Add this near the top with other imports

// --- STORAGE KEYS ---
const AUTH_USER_KEY = '@auth_user';
const AUTH_TOKEN_KEY = '@auth_token';
const CURRENT_USER_TECHVIBES_ID_KEY = '@current_user_techvibes_id';

// --- HELPER: Generate unique key per user ---
const getLastSelectedAccountKey = (techvibesId) => `last_selected_account_for_${techvibesId}`;

// --- ASYNC STORAGE HELPERS ---
const saveItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    console.log(`Storage: Saved ${key}`);
  } catch (error) {
    console.error(`Storage: Failed to save ${key}`, error);
  }
};

const getItem = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Storage: Failed to get ${key}`, error);
    return null;
  }
};

const removeItem = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log(`Storage: Removed ${key}`);
    return true;
  } catch (error) {
    console.error(`Storage: Failed to remove ${key}`, error);
    return false;
  }
};

// --- CREATE CONTEXT ---
const AuthContext = createContext();

// --- PROVIDER COMPONENT ---
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userToken, setUserToken] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [selectedAccount, setSelectedAccountState] = useState(null);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [currentUserTechvibesId, setCurrentUserTechvibesId] = useState(null);
  const [lastSelectedAccountNumber, setLastSelectedAccountNumber] = useState(null);

  // Destructure functions from the useEmailService hook
  const { sendEmail: coreSendEmail, createUserEmailSender } = useEmailService();


  // --- SET SELECTED ACCOUNT WITH PERSISTENCE ---
  const setSelectedAccount = useCallback(async (account) => {
    if (account?.account_number) {
      setSelectedAccountState(account);
      setLastSelectedAccountNumber(account.account_number);
      if (currentUserTechvibesId) {
        const key = getLastSelectedAccountKey(currentUserTechvibesId);
        await saveItem(key, {
          customer_id: account.customer_id,
          account_number: account.account_number,
          account,
        });
        console.log(`AuthContext: Saved selected account: ${account.account_number}`);
      }
    }
  }, [currentUserTechvibesId]);

  // --- INITIALIZE AUTH ON APP LAUNCH ---
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Starting initialization at', new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
        const storedToken = await getItem(AUTH_TOKEN_KEY);
        const storedUser = await getItem(AUTH_USER_KEY);
        const storedTechvibesId = await getItem(CURRENT_USER_TECHVIBES_ID_KEY);

        if (storedUser && storedToken && storedTechvibesId) {
          const techvibesId = storedTechvibesId;
          setCurrentUserTechvibesId(techvibesId);
          setAuthUser(storedUser);
          console.log('AuthContext: Loaded stored user and token, techvibesId:', techvibesId);

          const linkedResult = await fetchAllAccountsByTechvibesId(techvibesId);
          const accounts = linkedResult.success && Array.isArray(linkedResult.linkedAccounts)
            ? linkedResult.linkedAccounts
            : [storedUser];

          setLinkedAccounts(accounts);
          console.log(`AuthContext: Fetched ${accounts.length} linked accounts:`, accounts.map(a => a.account_number));

          const userSpecificLastAccountKey = getLastSelectedAccountKey(techvibesId);
          const storedLastAccount = await getItem(userSpecificLastAccountKey);
          let selected = null;

          if (storedLastAccount?.account_number) {
            selected = accounts.find(acc => acc.account_number === storedLastAccount.account_number);
            console.log('AuthContext: Attempted to restore last account:', storedLastAccount.account_number, 'Found:', selected ? 'Yes' : 'No');
          }

          if (!selected && accounts.length > 0) {
            selected = accounts[0];
            console.log('AuthContext: Defaulting to first account:', selected.account_number);
          }

          if (selected) {
            setSelectedAccountState(selected);
            setLastSelectedAccountNumber(selected.account_number);
            console.log('AuthContext: Selected account set to:', selected.account_number);
          } else {
            console.error('AuthContext: No account selected despite data.');
          }

          setUserToken(storedToken);
          setIsAuthenticated(true);
        } else {
          console.log('AuthContext: No stored session found.');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('AuthContext: Failed to initialize auth:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
        console.log('AuthContext: Initialization complete at', new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
      }
    };

    initializeAuth();
  }, []);

  // --- HANDLE LOGIN & RESTORE SELECTED ACCOUNT ---
  const setLoginState = useCallback(async ({ userData, userToken: newToken }) => {
    setIsAuthenticating(true);
    try {
      const techvibesId = userData.techvibes_id;
      console.log('Starting login process for techvibesId:', techvibesId);

      const linkedResult = await fetchAllAccountsByTechvibesId(techvibesId);
      const allAccounts = linkedResult.success && Array.isArray(linkedResult.linkedAccounts)
        ? linkedResult.linkedAccounts
        : [userData];

      console.log('Fetched accounts:', allAccounts.map(a => a.account_number));

      const userSpecificLastAccountKey = getLastSelectedAccountKey(techvibesId);
      const storedLastAccount = await getItem(userSpecificLastAccountKey);
      let accountToSelect = null;

      if (storedLastAccount?.account_number) {
        accountToSelect = allAccounts.find(acc => acc.account_number === storedLastAccount.account_number);
        console.log('Restore attempt result:', accountToSelect ? 'Found' : 'Not found');
      }

      if (!accountToSelect && allAccounts.length > 0) {
        accountToSelect = allAccounts[0];
        console.log('Using first account as fallback:', accountToSelect.account_number);
      }

      // Update state
      setCurrentUserTechvibesId(techvibesId);
      setAuthUser(userData);
      setLinkedAccounts(allAccounts);
      setSelectedAccountState(accountToSelect);
      setLastSelectedAccountNumber(accountToSelect?.account_number || null);
      setUserToken(newToken ?? null);
      setIsAuthenticated(true);
      console.log('Selected account:', accountToSelect?.account_number || 'None');

      // Save to storage
      await saveItem(AUTH_USER_KEY, userData);
      await saveItem(CURRENT_USER_TECHVIBES_ID_KEY, techvibesId);
      if (newToken) await saveItem(AUTH_TOKEN_KEY, newToken);
      if (accountToSelect) {
        await saveItem(userSpecificLastAccountKey, {
          customer_id: accountToSelect.customer_id,
          account_number: accountToSelect.account_number,
          account: accountToSelect,
        });
      }

      console.log('Login process completed successfully');
    } catch (error) {
      console.error('Login failed:', error);
      setIsAuthenticated(false);
      setUserToken(null);
      setAuthUser(null);
      setCurrentUserTechvibesId(null);
      setLinkedAccounts([]);
      setSelectedAccountState(null);
      setLastSelectedAccountNumber(null);
    } finally {
      setIsAuthenticating(false);
      setIsLoadingAuth(false);
    }
  }, []);

  // --- LOGOUT FUNCTION ---
  const logout = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      // Preserve the selected account in storage
      if (selectedAccount && currentUserTechvibesId) {
        const key = getLastSelectedAccountKey(currentUserTechvibesId);
        await saveItem(key, {
          customer_id: selectedAccount.customer_id,
          account_number: selectedAccount.account_number,
          account: selectedAccount,
        });
        console.log('Logout: Preserved selected account:', selectedAccount.account_number);
      }

      // Clear other auth state
      setIsAuthenticated(false);
      setUserToken(null);
      setAuthUser(null);
      setCurrentUserTechvibesId(null);
      setLinkedAccounts([]);
      setSelectedAccountState(null);
      setLastSelectedAccountNumber(null);

      // Clear storage except for the selected account (we keep it for post-login restore)
      await removeItem(AUTH_USER_KEY);
      await removeItem(CURRENT_USER_TECHVIBES_ID_KEY);
      await removeItem(AUTH_TOKEN_KEY);

      console.log('Logout successful');
      return { success: true, message: 'Logout successful.' };
    } catch (error) {
      console.error('Logout failed:', error);
      return { success: false, message: 'Logout failed. Please try again.' };
    } finally {
      setIsAuthenticating(false);
    }
  }, [selectedAccount, currentUserTechvibesId]);

  // --- UPDATE SELECTED ACCOUNT BALANCE ---
  const updateSelectedAccountBalance = useCallback(async (customerId, accountNumber) => {
    if (!customerId || !accountNumber || !userToken) {
      console.warn('Missing required data for balance update');
      return;
    }
    try {
      console.log('Balance update requested for:', accountNumber);
      // TODO: Implement actual balance fetch/update logic
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  }, [userToken]);

  // --- LOAD LAST SELECTED ACCOUNT ---
  const loadLastSelectedAccount = useCallback(async () => {
    if (currentUserTechvibesId) {
      const key = getLastSelectedAccountKey(currentUserTechvibesId);
      try {
        const storedLastAccount = await getItem(key);
        console.log('Loaded last account from storage:', storedLastAccount);
        if (storedLastAccount?.account_number) {
          const matchedAccount = linkedAccounts.find(acc =>
            acc.account_number === storedLastAccount.account_number
          );
          if (matchedAccount) {
            setSelectedAccountState(matchedAccount);
            setLastSelectedAccountNumber(matchedAccount.account_number);
            console.log('Successfully restored last selected account:', matchedAccount.account_number);
            return true;
          } else {
            console.warn('Stored account not found in linkedAccounts');
          }
        }
      } catch (error) {
        console.error('Error loading last selected account:', error);
      }
    }
    return false;
  }, [currentUserTechvibesId, linkedAccounts]);

  // --- DEBUG STORAGE ---
  const debugStorage = useCallback(async () => {
    if (currentUserTechvibesId) {
      const key = getLastSelectedAccountKey(currentUserTechvibesId);
      const storedValue = await getItem(key);
      console.log('Storage debug:', {
        key,
        storedValue,
        currentTechvibesId: currentUserTechvibesId,
        lastSelectedInMemory: lastSelectedAccountNumber,
        linkedAccounts: linkedAccounts.map(a => a.account_number)
      });
    }
  }, [currentUserTechvibesId, lastSelectedAccountNumber, linkedAccounts]);

  // --- REFRESH AUTH DATA (NEW) ---
const refreshAuthData = useCallback(async () => {
  if (!currentUserTechvibesId) {
    console.warn('refreshAuthData: No currentUserTechvibesId available');
    return null;
  }
  try {
    console.log('AuthContext: Starting refreshAuthData for techvibesId:', currentUserTechvibesId);
    const result = await fetchAllAccountsByTechvibesId(currentUserTechvibesId);
    if (result.success && Array.isArray(result.linkedAccounts)) {
      const updatedAccounts = result.linkedAccounts;
      setLinkedAccounts(updatedAccounts);
      console.log(`AuthContext: Fetched ${updatedAccounts.length} accounts during refresh.`);
      let refreshedSelectedAccount = null;
      if (selectedAccount?.account_number) {
        refreshedSelectedAccount = updatedAccounts.find(
          acc => acc.account_number === selectedAccount.account_number
        );
        if (refreshedSelectedAccount) {
          setSelectedAccountState(refreshedSelectedAccount);
          setLastSelectedAccountNumber(refreshedSelectedAccount.account_number);
          console.log('AuthContext: Successfully refreshed selected account:', refreshedSelectedAccount.account_number);
        } else {
          console.warn('AuthContext: Selected account not found in refreshed data. Falling back to first account.');
          const fallbackAccount = updatedAccounts[0] || null;
          if (fallbackAccount) {
            setSelectedAccountState(fallbackAccount);
            setLastSelectedAccountNumber(fallbackAccount.account_number);
            refreshedSelectedAccount = fallbackAccount;
            console.log('AuthContext: Fallback account set to:', fallbackAccount.account_number);
          }
        }
      } else if (updatedAccounts.length > 0) {
        const fallbackAccount = updatedAccounts[0];
        setSelectedAccountState(fallbackAccount);
        setLastSelectedAccountNumber(fallbackAccount.account_number);
        refreshedSelectedAccount = fallbackAccount;
        console.log('AuthContext: No selected account; defaulting to first:', fallbackAccount.account_number);
      }
      // Persist current selection
      if (refreshedSelectedAccount && currentUserTechvibesId) {
        const key = getLastSelectedAccountKey(currentUserTechvibesId);
        await saveItem(key, {
          customer_id: refreshedSelectedAccount.customer_id,
          account_number: refreshedSelectedAccount.account_number,
          account: refreshedSelectedAccount,
        });
        console.log('AuthContext: Persisted refreshed selected account to storage.');
      }
      return refreshedSelectedAccount;
    } else {
      console.error('AuthContext: Failed to refresh accounts:', result.message || 'Unknown error');
      throw new Error(result.message || 'Failed to refresh account data');
    }
  } catch (error) {
    console.error('AuthContext: Error in refreshAuthData:', error);
    throw error;
  }
}, [currentUserTechvibesId, selectedAccount, setSelectedAccountState, setLastSelectedAccountNumber, setLinkedAccounts]);


  // --- CONTEXT VALUE ---
  const authContextValue = {
    isAuthenticated,
    userToken,
    isLoadingAuth,
    isAuthenticating,
    authUser,
    selectedAccount,
    linkedAccounts,
    currentUserTechvibesId,
    setCurrentUserTechvibesId,
    setSelectedAccount,
    setLoginState,
    logout,
    updateSelectedAccountBalance,
    lastSelectedAccountNumber,
    updateAllAccounts: useCallback(async () => {
      if (currentUserTechvibesId) {
        const result = await fetchAllAccountsByTechvibesId(currentUserTechvibesId);
        if (result.success && Array.isArray(result.linkedAccounts)) {
          setLinkedAccounts(result.linkedAccounts);
          if (selectedAccount) {
            const updatedSelected = result.linkedAccounts.find(acc => acc.account_number === selectedAccount.account_number);
            if (updatedSelected) {
              setSelectedAccountState(updatedSelected);
              console.log('AuthContext: Updated selected account:', updatedSelected.account_number);
            }
          }
          console.log(`AuthContext: Refreshed to ${result.linkedAccounts.length} accounts.`);
        } else {
          console.warn('AuthContext: Failed to refresh linked accounts:', result.message);
        }
      }
    }, [currentUserTechvibesId, selectedAccount]),
    saveCurrentSelectedAccount: useCallback(async () => {
      if (selectedAccount && currentUserTechvibesId) {
        const key = getLastSelectedAccountKey(currentUserTechvibesId);
        await saveItem(key, {
          customer_id: selectedAccount.customer_id,
          account_number: selectedAccount.account_number,
          account: selectedAccount,
        });
        console.log(`AuthContext: Saved current selected account: ${selectedAccount.account_number}`);
      }
    }, [selectedAccount, currentUserTechvibesId]),
    loadLastSelectedAccount,
    debugStorage,
    refreshAuthData, // <-- Added to context

    /**
     * Gets a pre-configured email sender for the current authenticated user
     * @returns {{send: function}|null} Email sender object or null if no user email
     */
    getUserEmailSender: useCallback(() => {
      // Use authUser or selectedAccount for email, prioritize customer_email
      const userEmail = authUser?.customer_email || authUser?.email || selectedAccount?.customer_email || selectedAccount?.email;
      return createUserEmailSender(userEmail);
    }, [authUser, selectedAccount, createUserEmailSender]), // Add createUserEmailSender to dependencies

    /**
     * Directly send email to current user (convenience method)
     * @param {string} subject 
     * @param {string} body 
     * @param {boolean} isHtml 
     * @returns {Promise<{success: boolean, message: string}>}
     */
    sendEmailToUser: useCallback(async ({ subject, body, isHtml = true }) => {
      const userEmail = authUser?.customer_email || authUser?.email || selectedAccount?.customer_email || selectedAccount?.email;
      if (!userEmail) {
        console.warn('AuthContext: sendEmailToUser: No user email available');
        return { success: false, message: 'No user email available' };
      }
      
      // Use the coreSendEmail function obtained from useEmailService
      return coreSendEmail({
        toEmail: userEmail,
        subject,
        body,
        isHtml
      });
    }, [authUser, selectedAccount, coreSendEmail]), // Add coreSendEmail to dependencies
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// --- CUSTOM HOOK ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthContextProvider');
  }
  return context;
};
