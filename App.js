import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import * as Application from 'expo-application';
import { saveItem, getItem } from './utils/StorageService';

// Import all screen components
import LandingPage from './screens/LandingPage';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import History from './screens/History';
import Transfer from './screens/Transfer';
import Settings from './screens/Settings';
import Profile from './screens/Profile';
import Otheraccounts from './screens/Otheraccounts';
import Shop from './screens/Shop';
import POS from './screens/POS';
import Loan from './screens/Loan';
import Airtime from './screens/Airtime';
import DataScreen from './screens/Data';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen'; // Keep the import name as is
import Register from './screens/Register';
import Register2 from './screens/Register2';
import CreateNewAccount from './screens/CreateNewAccount';
import PaymentConfirmationScreen from './screens/PaymentConfirmationScreen';

// Device Fingerprint Key
const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';

// Generate or Retrieve Device Fingerprint on App Launch
const ensureDeviceFingerprint = async () => {
  try {
    let deviceId = await getItem(DEVICE_FINGERPRINT_KEY);
    if (!deviceId) {
      // Use stable native ID if available
      const nativeId = Application.androidId || (await Application.getIosIdForVendor());
      if (nativeId) {
        deviceId = nativeId;
      } else {
        // Fallback: Generate a unique ID
        deviceId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      await saveItem(DEVICE_FINGERPRINT_KEY, deviceId);
      console.log('✅ Generated new device fingerprint:', deviceId);
    } else {
      console.log('📱 Reusing existing device fingerprint:', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Failed to generate or retrieve device fingerprint', error);
    return null;
  }
};

// Create stack navigators
const AuthStack = createStackNavigator();
const AppStack = createStackNavigator();

// Authenticated Stack
function AuthenticatedNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Dashboard" component={Dashboard} />
      <AppStack.Screen name="History" component={History} />
      <AppStack.Screen name="Transfer" component={Transfer} />
      <AppStack.Screen name="Settings" component={Settings} />
      <AppStack.Screen name="Profile" component={Profile} />
      <AppStack.Screen name="Otheraccounts" component={Otheraccounts} />
      <AppStack.Screen name="Shop" component={Shop} />
      <AppStack.Screen name="POS" component={POS} />
      <AppStack.Screen name="Loan" component={Loan} />
      <AppStack.Screen name="Airtime" component={Airtime} />
      <AppStack.Screen name="DataPurchase" component={DataScreen} />
      <AppStack.Screen name="PaymentConfirmation" component={PaymentConfirmationScreen} />
      {/* Updated CreateNewAccount screen in Authenticated Navigator */}
      <AppStack.Screen
        name="CreateNewAccount"
        component={CreateNewAccount}
        options={{ title: 'Create New Bud Account', headerShown: false }} // Changed title and hid header
      />
    </AppStack.Navigator>
  );
}

// Unauthenticated Stack
function UnauthenticatedNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="LandingPage"
    >
      <AuthStack.Screen name="LandingPage" component={LandingPage} />
      <AuthStack.Screen name="Login" component={Login} />
      <AuthStack.Screen
        name="Register"
        component={Register}
        options={{ title: 'Register Account', headerShown: true }}
      />
      <AuthStack.Screen
        name="Register2"
        component={Register2}
        options={{ title: 'Account Security & ID', headerShown: true }}
      />
      {/* Changed name from "ForgotPasswordScreen" to "ForgotPassword" */}
      <AuthStack.Screen
        name="ForgotPassword" 
        component={ForgotPasswordScreen}
        options={{ title: 'Forgot Password', headerShown: true }}
      />
      {/* Updated CreateNewAccount screen in Unauthenticated Navigator */}
      <AuthStack.Screen
        name="CreateNewAccount"
        component={CreateNewAccount}
        options={{ title: 'Create New Bud Account', headerShown: false }} // Changed title and hid header
      />
      <AuthStack.Screen name="Shop" component={Shop} />
      <AuthStack.Screen name="POS" component={POS} />
    </AuthStack.Navigator>
  );
}

// Auth Gate: Safe access to auth state
function AuthGate() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CC9F0" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AuthenticatedNavigator /> : <UnauthenticatedNavigator />}
    </NavigationContainer>
  );
}

// Main App
export default function App() {
  useEffect(() => {
    ensureDeviceFingerprint();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
