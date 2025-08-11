import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

// Mock Haptics
const Haptics = {
  impactAsync: () => {},
  ImpactFeedbackStyle: { Light: 'light' }
};

// Styles
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 5,
  },
  iconButton: {
    alignItems: 'center',
    padding: 10,
    margin: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 17, 40, 0.7)',
    borderWidth: 1,
    flex: 1,
  },
  iconText: {
    fontSize: 12,
    marginTop: 6,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
});

const NavigableIcon = ({ iconName, label, targetScreen, size = 30, color, user }) => {
  const navigation = useNavigation();
  const scaleValue = useState(new Animated.Value(1))[0];

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true
    }).start();
  };
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(targetScreen, { user });
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }], width: '18%' }}>
      <TouchableOpacity
        style={[styles.iconButton, { borderColor: `${color}50` }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Icon
          name={iconName}
          size={size}
          color={color}
          style={{
            textShadowColor: `${color}CC`,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 15
          }}
        />
        <Text style={styles.iconText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Individual icon components
export const TransferIcon = ({ user }) => (
  <NavigableIcon
    iconName="swap-horizontal"
    label="Transfer"
    targetScreen="Transfer"
    color="#00F0FF"
    user={user}
  />
);

export const AirtimePurchaseIcon = ({ user }) => (
  <NavigableIcon
    iconName="phone-dial"
    label="Airtime"
    targetScreen="Airtime"
    color="#ffc107"
    user={user}
  />
);

export const DataPurchaseIcon = ({ user }) => (
  <NavigableIcon
    iconName="signal"
    label="Data"
    targetScreen="DataPurchase"
    color="#28a745"
    user={user}
  />
);

export const BillPaymentIcon = ({ user }) => (
  <NavigableIcon
    iconName="receipt"
    label="Bills"
    targetScreen="BillPayment"
    color="#dc3545"
    user={user}
  />
);

export const LoanIcon = ({ user }) => (
  <NavigableIcon
    iconName="hand-coin"
    label="Loan"
    targetScreen="Loan"
    color="#C17AFF"
    user={user}
  />
);

// Dashboard icons container (with the correct order)
const DashboardIcons = ({ user }) => (
  <View style={styles.container}>
    <TransferIcon user={user} />
    <AirtimePurchaseIcon user={user} />
    <DataPurchaseIcon user={user} />
    <BillPaymentIcon user={user} />
    <LoanIcon user={user} />
  </View>
);

export default DashboardIcons;