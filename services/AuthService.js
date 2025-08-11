import { Platform } from 'react-native';
import { saveItem, getItem, removeItem } from '../utils/StorageService';
import * as Application from 'expo-application'; // For device fingerprint
import * as Device from 'expo-device'; // For device metadata

// --- API ENDPOINTS ---
const API_BASE_URL = 'https://techvibs.com/bank/api_general/';
const API_ENDPOINTS = {
  DEVICE_CHECK: API_BASE_URL + 'device_mappings_api.php',
  DEVICE_REGISTER: API_BASE_URL + 'device_mappings_api.php',
  OTP_SERVICE: API_BASE_URL + 'OTP_Service_api.php',
   VERIFY_PIN: API_BASE_URL + 'verify_transaction_pin_api.php',
  FETCH_USER_DATA: API_BASE_URL + 'access_accountData_by_username_or_accountNo.php',
  LOGIN_VERIFY: API_BASE_URL + 'password_and_pin_verify_api.php',
  FETCH_PASSWORD: API_BASE_URL + 'fetch_password_api.php', // New endpoint for fetching password
};

// --- DEVICE FINGERPRINT MANAGEMENT ---
/**
 * Gets or generates a unique device fingerprint
 * @returns {Promise<string>} device fingerprint
 */
export const getDeviceId = async () => {
  const KEY = 'device_fingerprint';
  let deviceId = await getItem(KEY);

  // Reuse existing ID if available
  if (deviceId) {
    console.log('📱 Reusing existing device fingerprint:', deviceId);
    return deviceId;
  }

  // Platform-specific ID generation
  if (Platform.OS === 'web') {
    // Web: Use localStorage + random ID
    deviceId = localStorage.getItem(KEY);
    if (!deviceId) {
      deviceId = `web_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(KEY, deviceId);
    }
  } else {
    // Native (Android/iOS): Use expo-application or fallback
    try {
      deviceId = Application.androidId || (await Application.getIosIdForVendorAsync());
      if (!deviceId) {
        // Fallback for devices without a native ID
        deviceId = `${Device.brand || 'unknown'}_${Device.modelId || Date.now()}`;
      }
    } catch (error) {
      console.error('Failed to get native device ID:', error);
      deviceId = `fallback_${Date.now()}`;
    }
  }

  // Save the generated ID
  await saveItem(KEY, deviceId);
  console.log('✅ Generated new device fingerprint:', deviceId);
  return deviceId;
};

// Function to map the device
export const mapDevice = async (deviceData) => {
  try {
    const payload = {
      action: 'create',
      ...deviceData
    };
    const response = await _makeAuthRequest(API_ENDPOINTS.DEVICE_REGISTER, payload);
    if (response.success) {
      return {
        success: true,
        message: 'Device mapped successfully'
      };
    } else {
      return {
        success: false,
        message: response.message || 'Failed to map device'
      };
    }
  } catch (error) {
    console.error('Error mapping device:', error);
    return {
      success: false,
      message: error.message || 'Network error'
    };
  }
};

// Function to fetch password using biometric authentication
export const fetchPassword = async (userId, deviceFingerprint) => {
  try {
    const payload = {
      userId: userId,
      deviceFingerprint: deviceFingerprint
    };
    const response = await _makeAuthRequest(API_ENDPOINTS.FETCH_PASSWORD, payload);
    if (response.success) {
      return {
        success: true,
        password: response.data.hashedPassword
      };
    } else {
      return {
        success: false,
        message: response.message || 'Failed to fetch password'
      };
    }
  } catch (error) {
    console.error('Error fetching password:', error);
    return {
      success: false,
      message: error.message || 'Network error'
    };
  }
};

// --- DEVICE REGISTRATION & CHECK ---
export const registerDevice = async (deviceData) => {
  const payload = {
    action: 'create',
    ...deviceData
  };
  return await _makeAuthRequest(API_ENDPOINTS.DEVICE_REGISTER, payload);
};

export const checkDeviceRegistration = async (deviceId) => {
  const response = await _makeAuthRequest(API_ENDPOINTS.DEVICE_CHECK, {
    device_fingerprint: deviceId
  });
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Device mapping API failed'
    };
  }
  if (response.isMapped && response.user) {
    return {
      success: true,
      mapped: true,
      mapped_users: [response.user]
    };
  }
  return {
    success: true,
    mapped: false,
    mapped_users: []
  };
};

// --- FETCH USER DATA ---
export const fetchUserByIdentifier = async (identifier) => {
  try {
    const payload = {
      identifier: identifier
    };
    const response = await _makeAuthRequest(API_ENDPOINTS.FETCH_USER_DATA, payload);
    console.log('Raw API response for fetchUserByIdentifier:', response);
    if (response.success && response.data) {
      return {
        success: true,
        user: response.data.account,
        linkedAccounts: response.data.accounts || []
      };
    } else {
      return {
        success: false,
        message: response.message || 'Failed to fetch user data'
      };
    }
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    return {
      success: false,
      message: error.message || 'Network error'
    };
  }
};

// --- FETCH LINKED ACCOUNTS BY IDENTIFIER ---
export const fetchLinkedAccountsByIdentifier = async (identifier) => {
  try {
    const response = await fetch(`${API_BASE_URL}fetch_linked_accounts.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier }),
    });
    const result = await response.json();
    if (result.success) {
      return {
        success: true,
        linkedAccounts: result.linkedAccounts || [],
      };
    } else {
      return {
        success: false,
        message: result.message || 'Failed to fetch linked accounts',
      };
    }
  } catch (error) {
    console.error('Error fetching linked accounts:', error);
    return {
      success: false,
      message: error.message || 'Network error',
    };
  }
};

// --- LOGIN WITH PASSWORD ---
export const loginWithPassword = async ({ identifier, password }) => {
  try {
    const payload = {
      identifier: identifier,
      credential: password, // Match API expectation based on error message
    };
    const response = await _makeAuthRequest(API_ENDPOINTS.LOGIN_VERIFY, payload);
    if (response.success) {
      return {
        success: true,
        account: response.data.account,
        userToken: response.data.userToken || null,
      };
    } else {
      return {
        success: false,
        message: response.message || 'Invalid credentials',
      };
    }
  } catch (error) {
    console.error('Login with password failed:', error);
    return {
      success: false,
      message: error.message || 'Login failed. Check your internet connection.',
    };
  }
};

// --- FETCH ALL ACCOUNTS BY TECHVIBES ID ---
export const fetchAllAccountsByTechvibesId = async (techvibes_id) => {
  try {
    const response = await fetch(`${API_BASE_URL}fetch_accounts_by_techvibes_id.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ techvibes_id })
    });
    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(result.message || 'Failed to fetch accounts');
    }
    return {
      success: true,
      linkedAccounts: result.data.accounts,
      count: result.data.count
    };
  } catch (error) {
    console.error('Account fetch error:', error);
    return {
      success: false,
      error: error.message,
      linkedAccounts: [],
      count: 0
    };
  }
};

// --- VERIFY TRANSACTION PIN ---
export const verifyTransactionPin = async (customerId, pin) => {
  try {
    if (!customerId || !pin) {
      throw new Error('customerId and pin are required');
    }
    const response = await fetch(API_ENDPOINTS.VERIFY_PIN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        pin: pin.trim()
      })
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('AuthService: PIN verification failed:', error);
    return {
      success: false,
      message: error.message || 'PIN verification failed'
    };
  }
};

// --- OTP SERVICE ---
const _handleOtpAction = async (action, payload) => {
  const cleanPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = typeof value === 'string' ? value.trim() : value;
    }
    return acc;
  }, { action });
  const result = await _makeAuthRequest(API_ENDPOINTS.OTP_SERVICE, cleanPayload);
  if (action === 'send_otp' && result.success) {
    await saveItem('otp_cooldown', Date.now().toString());
  }
  return result;
};

export const sendOtp = async (params) => {
  try {
    const payload = {
      action: 'send_otp',
      email: params.email?.toLowerCase(),
      account_number: params.account_number,
      username: params.username,
      fintech: params.fintech,
      template: params.template || 'otp',
      first_name: params.firstName,
      last_name: params.lastName,
      other_names: params.otherNames,
      account_name: params.accountName,
      phone_no: params.phoneNo,
    };
    console.log('Sending OTP with payload:', payload);
    const response = await _makeAuthRequest(API_ENDPOINTS.OTP_SERVICE, payload);
    if (response.success) {
      await saveItem('otp_cooldown', Date.now().toString());
    }
    return response;
  } catch (error) {
    console.error('Error in sendOtp:', error);
    return { success: false, message: error.message || 'Failed to send OTP', error };
  }
};

export const resendOtp = (params) => sendOtp(params);

export const verifyOtp = async (params) => {
  try {
    if (!params.email || !params.otp) {
      throw new Error('Email and OTP are required');
    }
    const payload = {
      action: "verify_otp",
      email: params.email.toLowerCase().trim(),
      otp: params.otp.trim(),
      account_number: params.account_number || '',
      username: params.username || '',
      phone_no: params.phoneNo || ''
    };
    Object.keys(payload).forEach(key => {
      if (payload[key] === '') delete payload[key];
    });
    const response = await _makeAuthRequest(API_ENDPOINTS.OTP_SERVICE, payload);
    return {
      success: response.success === true,
      status: response.status || (response.success ? 'verified' : 'failed'),
      message: response.message || response.error || 'OTP verification completed',
      user: response.user || null,
      data: response.data || null
    };
  } catch (error) {
    console.error('OTP Verification Error:', error);
    return {
      success: false,
      status: 'error',
      message: error.message || 'OTP verification failed'
    };
  }
};

export const getOtpCooldown = async () => {
  const lastSent = await getItem('otp_cooldown');
  if (!lastSent) return 0;
  const elapsed = (Date.now() - parseInt(lastSent)) / 1000;
  return elapsed < 60 ? 60 - Math.floor(elapsed) : 0;
};

// --- SESSION MANAGEMENT ---
export const getSession = async () => {
  try {
    const session = await getItem('auth_session');
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('Failed to get session', error);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await removeItem('auth_session');
    await removeItem('device_fingerprint');
    await removeItem('otp_cooldown');
  } catch (error) {
    console.error('Failed to clear session', error);
  }
};

// --- DEBUGGING ---
export const debugStorage = async () => {
  console.log('=== STORAGE DUMP ===');
  const keys = ['auth_session', 'device_fingerprint', 'otp_cooldown'];
  for (const key of keys) {
    const value = await getItem(key);
    console.log(`${key}:`, value);
  }
  console.log('=== END STORAGE DUMP ===');
};

// --- INTERNAL: Authenticated Request Helper ---
const _makeAuthRequest = async (url, payload) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    console.log('Response:', responseText);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }
    const result = JSON.parse(responseText);
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: error.message || 'Network error', error };
  }
};
