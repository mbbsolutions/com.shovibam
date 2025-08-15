import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PropTypes from 'prop-types';

const ReceiptColourScheme = {
  backgroundWhite: '#FFFFFF',
  textDeepNavyBlue: '#1A2E4D',
  textLightGrey: '#6B7280',
  success: '#4CAF50',
  error: '#EF4444',
  borderLight: '#E5E7EB',
  accent: '#2196F3',
  buttonTextWhite: '#FFFFFF',
  pending: '#FFC107',
  exportSave: '#4CAF50',
  exportPdf: '#F44336',
  exportShare: '#2196F3',
};

const formatTransactionDate = (dateString) => {
  const dateObj = dateString ? new Date(dateString) : new Date();
  if (isNaN(dateObj.getTime())) {
    console.error("Invalid date provided to formatTransactionDate:", dateString);
    return "Invalid Date";
  }
  const datePart = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timePart = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
};

const formatMoney = (val) => {
  if (val === undefined || val === null || val === '') return '₦ 0.00';
  const num = parseFloat(val);
  if (isNaN(num)) return '₦ 0.00';
  return `₦ ${num.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const TransactionResultModal = ({
  visible,
  status = 'failed',
  title = 'Transaction Result',
  debug,
  onClose,
  transferDetails = {},
}) => {
  const { selectedAccount } = useAuth();

  // Sender details from selectedAccount
  const senderName = selectedAccount
    ? `${selectedAccount.customer_first_name || ''} ${selectedAccount.customer_last_name || ''}`.trim() || 'N/A'
    : 'N/A';
  const senderBank = selectedAccount?.bank_name || 'N/A';
  const senderAccount = selectedAccount?.account_number || 'N/A';

  // Recipient details from transferDetails
  const recipientName = transferDetails.account_name || 'N/A';
  const recipientAccount = transferDetails.account_number || 'N/A';
  const recipientBank = transferDetails.bank_name || 'N/A';
  const description = transferDetails.narration || transferDetails.description || 'N/A';
  const amount = transferDetails.amount || 0;
  const charges = transferDetails.charges || 0;
  const reference = transferDetails.reference || 'N/A';
  let message = transferDetails.message || ''; // Get the message from transferDetails

  // Check for insufficient balance messages and replace them
  // This handles messages passed directly or if the PHP API is still returning the original message
  const lowerMessage = message.toLowerCase();
  const insufficientPhrases = [
      'insufficient',
      'balance',
      'topup',
      'wallet',
      'low balance',
      'not enough',
      'fund',
      'recharge'
  ];

  let isInsufficient = false;
  for (const phrase of insufficientPhrases) {
      if (lowerMessage.includes(phrase)) {
          isInsufficient = true;
          break;
      }
  }

  // Also check if the error code indicates insufficient funds (from PHP API)
  if (isInsufficient || transferDetails.code === 'INSUFFICIENT_FUNDS') {
    message = 'ISB, Please Reachout to us for assistance';
  }

  // Determine header color and icon based on status
  const headerColor = status === 'success' ? ReceiptColourScheme.success :
    status === 'pending' ? ReceiptColourScheme.pending :
    ReceiptColourScheme.error;
  const iconName = status === 'success' ? 'check-circle' :
    status === 'pending' ? 'hourglass-empty' :
    'cancel';

  // Update title - show empty string if it's the ISB message
  const displayTitle = message === 'ISB, Please Reachout to us for assistance'
    ? ''
    : title; // RESTORED LOGIC HERE

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {/* Status Icon */}
          <View style={styles.iconContainer}>
            <Icon name={iconName} size={60} color={headerColor} />
          </View>
          {/* Main Header */}
          {/* The condition `displayTitle !== ''` is still important here */}
          {displayTitle !== '' && ( 
            <Text style={[styles.mainHeader, { color: headerColor }]}>{displayTitle}</Text>
          )}
          <ScrollView style={styles.scrollView}>
            {/* Display error message if status is 'failed' */}
            {status === 'failed' && message && (
              <View style={[styles.section, { borderBottomWidth: 0 }]}>
                <Text style={styles.sectionHeader}>Reason for Failure</Text>
                <Text style={styles.failMessage}>{message}</Text>
              </View>
            )}

            {/* Sender Info */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Sender Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name:</Text>
                <Text style={styles.detailValue}>{senderName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bank:</Text>
                <Text style={styles.detailValue}>{senderBank}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account:</Text>
                <Text style={styles.detailValue}>{senderAccount}</Text>
              </View>
            </View>
            {/* Transaction Details */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Transaction Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Amount:</Text>
                <Text style={styles.detailValue}>{formatMoney(amount)}</Text>
              </View>
              {charges > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Charges:</Text>
                  <Text style={styles.detailValue}>{formatMoney(charges)}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Description:</Text>
                <Text style={styles.detailValue}>{description}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference:</Text>
                <Text style={styles.detailValue}>{reference}</Text>
              </View>
            </View>
            {/* Recipient Details */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Recipient Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name:</Text>
                <Text style={styles.detailValue}>{recipientName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account:</Text>
                <Text style={styles.detailValue}>{recipientAccount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bank:</Text>
                <Text style={styles.detailValue}>{recipientBank}</Text>
              </View>
            </View>
          </ScrollView>
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.shareButton]}
              onPress={() => {
                Alert.alert("Share", "Share functionality can be implemented here!");
              }}
            >
              <Text style={styles.buttonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.doneButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

TransactionResultModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  status: PropTypes.oneOf(['success', 'failed', 'pending']),
  title: PropTypes.string,
  debug: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  transferDetails: PropTypes.shape({
    account_name: PropTypes.string,
    account_number: PropTypes.string,
    bank_name: PropTypes.string,
    narration: PropTypes.string,
    description: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    charges: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    reference: PropTypes.string,
    message: PropTypes.string, // Add message to PropTypes
    code: PropTypes.string,    // Add code to PropTypes
  }),
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalView: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: ReceiptColourScheme.backgroundWhite,
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    maxHeight: '85%',
  },
  iconContainer: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  mainHeader: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  scrollView: {
    flexGrow: 1,
    width: '100%',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: ReceiptColourScheme.borderLight,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ReceiptColourScheme.textDeepNavyBlue,
    marginBottom: 12,
  },
  failMessage: {
    fontSize: 16,
    color: ReceiptColourScheme.error,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
    paddingHorizontal: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 15,
    color: ReceiptColourScheme.textLightGrey,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: ReceiptColourScheme.textDeepNavyBlue,
    textAlign: 'right',
    flex: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    flex: 1,
    maxWidth: 150,
  },
  shareButton: {
    backgroundColor: ReceiptColourScheme.accent,
  },
  doneButton: {
    backgroundColor: ReceiptColourScheme.textDeepNavyBlue,
  },
  buttonText: {
    color: ReceiptColourScheme.buttonTextWhite,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TransactionResultModal;
