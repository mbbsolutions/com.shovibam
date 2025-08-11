import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

// Core Storage Functions (unchanged logic for saving/getting/removing items)
export const saveItem = async (key, value) => {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (isWeb) {
      localStorage.setItem(key, stringValue);
    } else {
      await AsyncStorage.setItem(key, stringValue);
    }
    return true;
  } catch (error) {
    console.error(`Storage: Failed to save ${key}`, error);
    throw error; // Re-throw to allow calling functions to handle
  }
};

export const getItem = async (key) => {
  try {
    const value = isWeb ? localStorage.getItem(key) : await AsyncStorage.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value); // Attempt to parse JSON
    } catch {
      return value; // If not JSON, return as string
    }
  } catch (error) {
    console.error(`Storage: Failed to get ${key}`, error);
    throw error; // Re-throw to allow calling functions to handle
  }
};

export const removeItem = async (key) => {
  try {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    console.error(`Storage: Failed to remove ${key}`, error);
    throw error; // Re-throw to allow calling functions to handle
  }
};

// New Recent Purchases Functions (with safety checks)
const RECENT_PURCHASES_KEY = (userId) => `@user_${userId}_recent_purchases`;

export const saveRecentPurchase = async (userId, purchase) => {
  if (!userId || !purchase) {
    console.error('Invalid arguments for saveRecentPurchase: userId or purchase is missing.');
    return []; // Return empty array on invalid input
  }

  try {
    const key = RECENT_PURCHASES_KEY(userId);
    const existing = (await getItem(key)) || [];
    
    // Validate existing data structure: Ensure it's an array
    const validatedExisting = Array.isArray(existing) ? existing : [];
    
    // Validate and sanitize new purchase object
    const validatedPurchase = {
      id: purchase.id || generateUniqueId(), // Ensure unique ID
      provider: purchase.provider || '',
      planName: purchase.planName || '',
      phoneNumber: purchase.phoneNumber || '',
      amount: purchase.amount || 0,
      date: purchase.date || new Date().toISOString(),
      status: purchase.status || 'attempted', // Default status
      ...purchase // Spread to maintain any additional fields passed
    };

    // Find and update if exists, otherwise add to front
    const updatedPurchases = [...validatedExisting];
    const existingIndex = updatedPurchases.findIndex(p => p.id === validatedPurchase.id);

    if (existingIndex > -1) {
        updatedPurchases[existingIndex] = validatedPurchase;
    } else {
        updatedPurchases.unshift(validatedPurchase); // Add to the beginning
    }

    // Keep only the latest 10 purchases
    const finalPurchases = updatedPurchases.slice(0, 10);

    await saveItem(key, finalPurchases);
    return finalPurchases; // Return the new list
  } catch (error) {
    console.error('Failed to save recent purchase:', error);
    return []; // Return empty array on error
  }
};

export const getRecentPurchases = async (userId) => {
  if (!userId) {
    console.error('No userId provided to getRecentPurchases. Returning empty array.');
    return [];
  }

  try {
    const key = RECENT_PURCHASES_KEY(userId);
    const purchases = await getItem(key);
    
    // Validate the returned data structure: Ensure it's an array
    if (!Array.isArray(purchases)) {
      console.warn(`Invalid recent purchases data format for user ${userId}. Returning empty array.`);
      return [];
    }
    
    return purchases;
  } catch (error) {
    console.error('Failed to get recent purchases:', error);
    return []; // Return empty array on error
  }
};

// Helper to generate a simple unique ID
const generateUniqueId = () => {
  return 'id-' + Math.random().toString(36).substr(2, 9) + Date.now();
};

// Debug function (unchanged)
export const debugStorageContents = async () => {
  if (isWeb) {
    console.log('Web Storage:', { ...localStorage });
  } else {
    try {
      console.log('RN Storage Keys:', await AsyncStorage.getAllKeys());
    } catch (error) {
      console.error('Failed to get AsyncStorage keys:', error);
    }
  }
};

// Migration function for existing users (if needed)
export const migrateLegacyPurchases = async (userId) => {
  if (!userId) {
    console.warn('migrateLegacyPurchases: userId is null or undefined.');
    return;
  }
  try {
    const legacyKey = `@recent_purchases_${userId}`; // Old key format
    const newKey = RECENT_PURCHASES_KEY(userId); // New key format
    
    // Check if legacy data exists and new data doesn't
    const legacyData = await getItem(legacyKey);
    const newData = await getItem(newKey);

    if (legacyData && (!newData || newData.length === 0)) {
      console.log(`Migrating legacy purchases for user ${userId}...`);
      await saveItem(newKey, legacyData);
      await removeItem(legacyKey); // Remove old data after successful migration
      console.log(`Migration successful for user ${userId}.`);
    } else if (legacyData && newData && newData.length > 0) {
        console.log(`Legacy data found for user ${userId}, but new format already exists. Skipping migration.`);
        await removeItem(legacyKey); // Clean up legacy key if new data is present
    } else {
        console.log(`No legacy purchases found for user ${userId} or already migrated.`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
};
