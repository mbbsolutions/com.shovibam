import { Platform, Alert } from 'react-native';

let Share;
try {
  Share = require('react-native-share').default;
} catch (error) {
  console.warn('react-native-share module not available:', error);
}

const formatAmount = (value) => {
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
    const num = parseFloat(value);
    return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value;
};

export const printTransaction = async (transaction) => {
  if (!transaction) {
    console.error('No transaction data provided for printing.');
    if (Platform.OS === 'web') {
      alert('No transaction data to print.');
    } else {
      Alert.alert('Error', 'No transaction data to print.');
    }
    return;
  }

  const transactionDetailsHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction Details</title>
      <style>
        body { font-family: 'Inter', sans-serif; margin: 20px; color: #333; }
        h1 { text-align: center; color: #0056b3; margin-bottom: 20px; }
        .details-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          border: 1px solid #eee;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed #eee;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: bold;
          color: #555;
          flex: 1;
        }
        .detail-value {
          text-align: right;
          flex: 2;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 0.9em;
          color: #777;
        }
      </style>
    </head>
    <body>
      <h1>Transaction Receipt</h1>
      <div class="details-container">
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${transaction.transactionDate || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Type:</span>
          <span class="detail-value">${transaction.type || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount:</span>
          <span class="detail-value">${transaction.currency} ${formatAmount(transaction.amount)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fees:</span>
          <span class="detail-value">${formatAmount(transaction.internalFeesAmount || 0)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Reference:</span>
          <span class="detail-value">${transaction.reference || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value">${transaction.status || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Balance:</span>
          <span class="detail-value">${transaction.currency} ${formatAmount(transaction.balance)}</span>
        </div>
        ${transaction.description ? `
        <div class="detail-row">
          <span class="detail-label">Description:</span>
          <span class="detail-value">${transaction.description}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Source Account:</span>
          <span class="detail-value">${transaction.sourceAccount || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Destination Account:</span>
          <span class="detail-value">${transaction.destinationAccount || 'N/A'}</span>
        </div>
      </div>
      <div class="footer">
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(transactionDetailsHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  } else if (Share) {
    try {
      const message = `
Transaction Receipt
Date: ${transaction.transactionDate || 'N/A'}
Type: ${transaction.type || 'N/A'}
Amount: ${transaction.currency} ${formatAmount(transaction.amount)}
Fees: ${formatAmount(transaction.internalFeesAmount || 0)}
Reference: ${transaction.reference || 'N/A'}
Status: ${transaction.status || 'N/A'}
Balance: ${transaction.currency} ${formatAmount(transaction.balance)}
Description: ${transaction.description || 'N/A'}
Source Account: ${transaction.sourceAccount || 'N/A'}
Destination Account: ${transaction.destinationAccount || 'N/A'}
Generated on: ${new Date().toLocaleString()}
      `.trim();

      await Share.share({
        message,
        title: 'Transaction Receipt',
      });
    } catch (error) {
      console.error('printTransaction: Error sharing transaction:', error);
      Alert.alert('Error', 'Failed to share transaction receipt. Please try again.');
    }
  } else {
    Alert.alert('Error', 'Sharing is not available on this device. Please ensure the app is properly configured.');
  }
};