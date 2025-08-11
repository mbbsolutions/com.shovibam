import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, StyleSheet, Modal, Animated, TouchableOpacity, Share, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { verifyTransactionPin } from '../services/AuthService';
import { useAuth } from '../contexts/AuthContext';

// Define a specific color scheme for this popup
const PinPopupColourScheme = {
    backgroundNavy: '#1A2E4D',
    textBright: '#FFFFFF',
    textLightGrey: '#A0AEC0',
    inputBorder: '#4A5568',
    inputBackground: '#2D3748',
    success: '#4CAF50',
    error: '#EF4444',
    pending: '#FFC107',
    buttonCancel: '#6B7280',
    buttonShare: '#2196F3',
    buttonPrint: '#00BCD4',
    buttonDisabled: '#4A5568',
    shadowColor: '#000',
};

// AnimatedDots Component
const AnimatedDots = ({ inputWidth = 0, colorA = PinPopupColourScheme.success, colorB = PinPopupColourScheme.error, diameter = 6, spacing = 6 }) => {
    const [translateAnim] = useState(new Animated.Value(0));
    const effectiveWidth = inputWidth > 0 ? inputWidth : 180;
    const numDots = Math.max(15, Math.floor((effectiveWidth + spacing) / (diameter + spacing)));
    const dotsRowWidth = numDots * diameter + (numDots - 1) * spacing;
    const maxTranslate = Math.max(0, effectiveWidth - dotsRowWidth);

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(translateAnim, {
                    toValue: maxTranslate,
                    duration: 1000,
                    useNativeDriver: true
                }),
                Animated.timing(translateAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [translateAnim, maxTranslate]);

    return (
        <View style={{ width: effectiveWidth, height: diameter + 2, overflow: 'hidden', marginTop: 1, marginBottom: 2 }}>
            <Animated.View style={{
                flexDirection: 'row',
                alignItems: 'center',
                transform: [{ translateX: translateAnim }],
                width: dotsRowWidth,
            }}>
                {Array.from({ length: numDots }).map((_, i) => (
                    <View
                        key={i}
                        style={{
                            width: diameter,
                            height: diameter,
                            borderRadius: diameter / 2,
                            backgroundColor: i % 2 === 0 ? colorA : colorB,
                            marginRight: i !== numDots - 1 ? spacing : 0,
                            opacity: 0.9,
                        }}
                    />
                ))}
            </Animated.View>
        </View>
    );
};

const PinVerifyPopup = ({
    visible,
    mode = 'pin',
    onPinVerifiedSuccess,
    loading: parentLoading,
    inputPin,
    setPin,
    transferDetails: {
        amount,
        recipientName,
        recipientAcct,
        recipientBankName,
        description,
        charges,
    } = {},
    popupContent: {
        resultStatus,
        resultTitle,
        resultReason,
        reference,
        debug,
    } = {},
    onClose,
    onPopUpComplete,
    isStandalonePinVerify = false,
}) => {
    const { selectedAccount } = useAuth();
    const customerId = selectedAccount?.customer_id;
    const [pinInputWidth, setPinInputWidth] = useState(0);
    const [pinStatus, setPinStatus] = useState('idle');
    const [pinStatusMsg, setPinStatusMsg] = useState('');
    const [verifyingPin, setVerifyingPin] = useState(false);

    const formatMoney = (val) => {
        if (val === undefined || val === null || val === '') return '';
        const sanitized = String(val).replace(/[^0-9.]/g, '');
        if (sanitized === '' || sanitized === '.') return '';
        const num = Number(sanitized);
        if (isNaN(num)) return '';
        return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleShare = async () => {
        try {
            const shareMessage = `Transaction Status: ${resultStatus === 'success' ? 'Successful' : 'Failed'}
Amount: ₦${formatMoney(amount)}
To: ${recipientName}
Account: ${recipientAcct}
Bank: ${recipientBankName}`;
            const result = await Share.share({ message: shareMessage });
            if (result.action === Share.sharedAction) {
                console.log('Shared successfully');
            } else if (result.action === Share.dismissedAction) {
                console.log('Share dismissed');
            }
        } catch (error) {
            console.error('Error sharing:', error.message);
            console.log('Failed to share: ' + error.message);
        }
    };

    const handlePrint = () => {
        console.log('Print functionality would be implemented here.');
    };

    useEffect(() => {
        let isMounted = true;
        const verifyPin = async () => {
            if (!customerId) {
                if (isMounted) {
                    setPinStatus('error');
                    setPinStatusMsg('Error: No customer ID provided for PIN verification.');
                }
                console.error('PIN Verification Error: No customer ID.');
                return;
            }
            if (isMounted) {
                setVerifyingPin(true);
                setPinStatus('verifying');
                setPinStatusMsg('');
            }
            try {
                console.log('Sending PIN verification request with:', { customer_id: customerId, pin: '****' });
                const result = await verifyTransactionPin(customerId, inputPin ? inputPin.trim() : "");
                console.log('Server response from verifyTransactionPin:', result);
                if (!isMounted) return;
                if (result.success) {
                    setPinStatus('success');
                    setPinStatusMsg('PIN correct');
                } else {
                    setPinStatus('error');
                    setPinStatusMsg(result.message || 'Incorrect PIN');
                }
            } catch (err) {
                console.error('Error verifying PIN:', err);
                if (isMounted) {
                    setPinStatus('error');
                    setPinStatusMsg('Error verifying PIN: ' + (err.message || 'Network issue.'));
                }
            } finally {
                if (isMounted) {
                    setVerifyingPin(false);
                }
            }
        };

        if (mode === 'pin' && inputPin.length === 4) {
            verifyPin();
        } else if (inputPin.length < 4) {
            setPinStatus('idle');
            setPinStatusMsg('');
        }

        return () => {
            isMounted = false;
        };
    }, [inputPin, mode, customerId]);

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
        if (mode === 'result' && onPopUpComplete) {
            onPopUpComplete();
        }
    };

    const handleSendButtonPress = () => {
        if (pinStatus === 'success' && onPinVerifiedSuccess) {
            onPinVerifiedSuccess();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    {mode === 'pin' ? (
                        <>
                            <Text style={styles.modalTitle}>
                                {isStandalonePinVerify ? 'Confirm & Send with PIN' : 'Enter Transaction PIN'}
                            </Text>
                            {customerId ? (
                                <Text style={styles.customerIdText} selectable>
                                    Customer ID: {customerId}
                                </Text>
                            ) : (
                                <Text style={styles.errorText}>Customer ID not available.</Text>
                            )}
                            <Text style={styles.confirmationPrompt}>Are you sure you want to send:</Text>
                            {amount ? (
                                <Text style={styles.amountText}>₦{formatMoney(amount)}</Text>
                            ) : (
                                <Text style={styles.errorText}>Amount Not Provided</Text>
                            )}
                            {charges && parseFloat(charges) > 0 && (
                                <Text style={styles.detailText}>(Charges: ₦{formatMoney(charges)})</Text>
                            )}
                            <Text style={styles.confirmationPrompt}>to:</Text>
                            <Text style={styles.recipientNameText}>{recipientName || 'recipient'}</Text>
                            {recipientAcct && <Text style={styles.recipientDetailText}>{recipientAcct}</Text>}
                            {recipientBankName && <Text style={styles.recipientDetailText}>{recipientBankName}</Text>}
                            {description && <Text style={styles.recipientDetailText}>Description: {description}</Text>}
                            <View style={styles.pinInputContainer} onLayout={e => setPinInputWidth(e.nativeEvent.layout.width)}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        pinStatus === 'error' && styles.inputErrorBorder,
                                        pinStatus === 'success' && styles.inputSuccessBorder,
                                    ]}
                                    value={inputPin}
                                    onChangeText={setPin}
                                    keyboardType="numeric"
                                    secureTextEntry
                                    maxLength={4}
                                    placeholder="PIN"
                                    placeholderTextColor={PinPopupColourScheme.textLightGrey}
                                    autoFocus
                                />
                                <View style={styles.pinStatusIndicator}>
                                    {pinStatus === 'verifying' && (
                                        <AnimatedDots inputWidth={pinInputWidth} colorA={PinPopupColourScheme.success} colorB={PinPopupColourScheme.error} diameter={6} spacing={6} />
                                    )}
                                    {pinStatus === 'success' && <View style={styles.successIndicator} />}
                                    {pinStatus === 'error' && <View style={styles.errorIndicator} />}
                                </View>
                            </View>
                            {(pinStatus === 'error' || pinStatus === 'success') && (
                                <Text style={[
                                    styles.pinStatusMessage,
                                    pinStatus === 'success' ? styles.successText : styles.errorText,
                                ]}>
                                    {pinStatusMsg}
                                </Text>
                            )}
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton, { flex: 1, minWidth: 80, backgroundColor: PinPopupColourScheme.buttonCancel }]}
                                    onPress={handleClose}
                                    disabled={verifyingPin || parentLoading}
                                >
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        styles.sendButton,
                                        { flex: 1, minWidth: 80 },
                                        pinStatus !== 'success' || verifyingPin || parentLoading ? styles.disabledButton : {},
                                    ]}
                                    onPress={handleSendButtonPress}
                                    disabled={pinStatus !== 'success' || verifyingPin || parentLoading}
                                >
                                    <Text style={styles.buttonText}>
                                        {parentLoading ? 'Sending...' : 'Send'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <Icon
                                name={
                                    resultStatus === 'success'
                                        ? 'check-circle'
                                        : resultStatus === 'pending'
                                            ? 'hourglass-empty'
                                            : 'cancel'
                                }
                                size={56}
                                color={
                                    resultStatus === 'success'
                                        ? PinPopupColourScheme.success
                                        : resultStatus === 'pending'
                                            ? PinPopupColourScheme.pending
                                            : PinPopupColourScheme.error
                                }
                            />
                            <Text style={[
                                styles.resultTitle,
                                resultStatus === 'success'
                                    ? styles.successText
                                    : resultStatus === 'pending'
                                        ? styles.pendingText
                                        : styles.errorText,
                            ]}>
                                {resultTitle}
                            </Text>
                            <ScrollView style={styles.detailsScrollView}>
                                <View style={styles.detailsContent}>
                                    <Text style={styles.detailPrompt}>Amount:</Text>
                                    {amount && formatMoney(amount) ? (
                                        <Text style={styles.amountDisplay}>₦{formatMoney(amount)}</Text>
                                    ) : (
                                        <Text style={styles.errorText}>Amount Not Provided</Text>
                                    )}
                                    {charges && parseFloat(charges) > 0 && (
                                        <Text style={styles.detailText}>(Charges: ₦{formatMoney(charges)})</Text>
                                    )}
                                    <Text style={styles.detailPrompt}>To:</Text>
                                    {recipientName ? (
                                        <Text style={styles.recipientNameDisplay}>{recipientName}</Text>
                                    ) : (
                                        <Text style={styles.errorText}>No Recipient</Text>
                                    )}
                                    {recipientAcct && <Text style={styles.recipientDetailDisplay}>{recipientAcct}</Text>}
                                    {recipientBankName && <Text style={styles.recipientDetailDisplay}>{recipientBankName}</Text>}
                                    {reference && <Text style={styles.detailText}>Ref: {reference}</Text>}
                                    {description && <Text style={styles.detailText}>Description: {description}</Text>}
                                    {resultReason && (
                                        <Text style={[
                                            styles.resultReasonText,
                                            resultStatus === 'error' ? styles.errorText : styles.defaultText,
                                        ]}>
                                            {resultReason}
                                        </Text>
                                    )}
                                </View>
                            </ScrollView>
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity style={[styles.button, styles.shareButton]} onPress={handleShare}>
                                    <Text style={styles.buttonText}>Share</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.printButton]} onPress={handlePrint}>
                                    <Text style={styles.buttonText}>Print</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.okButton]} onPress={handleClose}>
                                    <Text style={styles.buttonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContainer: {
        backgroundColor: PinPopupColourScheme.backgroundNavy,
        borderRadius: 8,
        padding: 24,
        width: '80%',
        alignItems: 'center',
        maxHeight: '80%',
        shadowColor: PinPopupColourScheme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
    },
    modalTitle: {
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fontSize: 17,
        marginBottom: 12,
        color: PinPopupColourScheme.textBright,
    },
    customerIdText: {
        fontFamily: 'Inter',
        fontSize: 13,
        backgroundColor: PinPopupColourScheme.inputBackground,
        padding: 6,
        borderRadius: 6,
        color: PinPopupColourScheme.textBright,
        marginBottom: 8,
    },
    confirmationPrompt: {
        fontFamily: 'Inter',
        fontSize: 15,
        color: PinPopupColourScheme.textLightGrey,
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 2,
    },
    amountText: {
        fontFamily: 'Inter',
        fontWeight: 'bold',
        color: PinPopupColourScheme.textBright,
        fontSize: 20,
        marginBottom: 5,
        textAlign: 'center',
    },
    recipientNameText: {
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 2,
        textAlign: 'center',
        color: PinPopupColourScheme.textBright,
    },
    recipientDetailText: {
        fontFamily: 'Inter',
        color: PinPopupColourScheme.textLightGrey,
        fontSize: 14,
        marginBottom: 2,
        textAlign: 'center',
    },
    pinInputContainer: {
        position: 'relative',
        width: '100%',
        marginTop: 15,
        marginBottom: 10,
    },
    input: {
        fontFamily: 'Inter',
        borderWidth: 1,
        borderColor: PinPopupColourScheme.inputBorder,
        padding: 12,
        borderRadius: 5,
        fontSize: 16,
        backgroundColor: PinPopupColourScheme.inputBackground,
        width: '100%',
        textAlign: 'center',
        letterSpacing: 10,
        color: PinPopupColourScheme.textBright,
    },
    inputErrorBorder: {
        borderColor: PinPopupColourScheme.error,
    },
    inputSuccessBorder: {
        borderColor: PinPopupColourScheme.success,
    },
    pinStatusIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -13,
        alignItems: 'center',
    },
    successIndicator: {
        height: 3,
        backgroundColor: PinPopupColourScheme.success,
        borderRadius: 2,
        width: '80%',
        alignSelf: 'center',
        marginVertical: 2,
    },
    errorIndicator: {
        height: 3,
        backgroundColor: PinPopupColourScheme.error,
        borderRadius: 2,
        width: '80%',
        alignSelf: 'center',
        marginVertical: 2,
    },
    pinStatusMessage: {
        fontFamily: 'Inter',
        marginTop: 8,
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 14,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 18,
        width: '100%',
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 5,
    },
    buttonText: {
        fontFamily: 'Inter',
        color: PinPopupColourScheme.textBright,
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelButton: {
        backgroundColor: PinPopupColourScheme.buttonCancel,
    },
    sendButton: {
        backgroundColor: PinPopupColourScheme.success,
    },
    okButton: {
        backgroundColor: PinPopupColourScheme.success,
    },
    shareButton: {
        backgroundColor: PinPopupColourScheme.buttonShare,
    },
    printButton: {
        backgroundColor: PinPopupColourScheme.buttonPrint,
    },
    disabledButton: {
        opacity: 0.5,
        backgroundColor: PinPopupColourScheme.buttonDisabled,
    },
    resultTitle: {
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fontSize: 19,
        marginTop: 10,
        textAlign: 'center',
    },
    detailsScrollView: {
        marginTop: 18,
        width: '100%',
        flexGrow: 1,
    },
    detailsContent: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    detailPrompt: {
        fontFamily: 'Inter',
        fontSize: 16,
        marginBottom: 4,
        textAlign: 'center',
        color: PinPopupColourScheme.textLightGrey,
    },
    amountDisplay: {
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fontSize: 22,
        marginBottom: 8,
        textAlign: 'center',
        color: PinPopupColourScheme.textBright,
    },
    recipientNameDisplay: {
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 2,
        textAlign: 'center',
        color: PinPopupColourScheme.textBright,
    },
    recipientDetailDisplay: {
        fontFamily: 'Inter',
        color: PinPopupColourScheme.textLightGrey,
        fontSize: 15,
        marginBottom: 2,
        textAlign: 'center',
    },
    detailText: {
        fontFamily: 'Inter',
        color: PinPopupColourScheme.textLightGrey,
        fontSize: 13,
        marginBottom: 8,
        textAlign: 'center',
    },
    resultReasonText: {
        fontFamily: 'Inter',
        fontStyle: 'italic',
        fontSize: 14,
        marginBottom: 8,
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    successText: {
        color: PinPopupColourScheme.success,
    },
    errorText: {
        color: PinPopupColourScheme.error,
    },
    pendingText: {
        color: PinPopupColourScheme.pending,
    },
    defaultText: {
        color: PinPopupColourScheme.textBright,
    },
});

export default PinVerifyPopup;
