import React, { useState, useEffect } from 'react';

// This is the new utility file, replacing otpGeneral.
// It simulates an asynchronous API call to verify the OTP.
// In a real-world application, this would be a fetch() call to your backend.
const authService = {
  verifyOtp: async ({ email, otp, account_number, username, fintech, phoneNo }) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // A simple mock for OTP validation.
    // For this example, '123456' is the correct OTP.
    if (otp === '123456') {
      return {
        success: true,
        message: 'OTP verified successfully!',
        user: { email, username } // Example user data
      };
    } else {
      return {
        success: false,
        message: 'Invalid OTP. Please try again.'
      };
    }
  },
};

/**
 * OtpValidation Component
 * A reusable component for entering and validating an OTP.
 *
 * @param {Object} props - Component props
 * @param {string} props.email - The email address associated with the OTP.
 * @param {string} [props.account_number=''] - Optional account number for OTP verification.
 * @param {string} [props.username=''] - Optional username for OTP verification.
 * @param {string} [props.fintech=''] - Optional fintech identifier for OTP verification.
 * @param {string} [props.phoneNo=''] - Optional phone number for OTP verification.
 * @param {function} props.onOtpVerified - Callback function to execute on successful OTP verification.
 * @param {function} [props.onOtpVerificationFailed] - Optional callback for failed verification.
 */
const OtpValidation = ({ 
    email, 
    account_number = '', 
    username = '', 
    fintech = '', 
    phoneNo = '', 
    onOtpVerified,
    onOtpVerificationFailed 
}) => {
    const [otp, setOtp] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' or 'error'
    const [isLoading, setIsLoading] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    // Reset component state if the email (or other key identifiers) changes
    useEffect(() => {
        setOtp('');
        setMessage('');
        setMessageType('');
        setIsLoading(false);
        setIsVerified(false);
    }, [email, account_number, username, fintech, phoneNo]);

    const handleVerifyOtp = async () => {
        // Basic input validation
        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            setMessage('Please enter a valid 6-digit OTP.');
            setMessageType('error');
            return;
        }

        if (!email) {
            setMessage('Email is missing. Cannot verify OTP.');
            setMessageType('error');
            return;
        }

        setIsLoading(true);
        setMessage('Verifying OTP...');
        setMessageType('info'); // Use info for a pending state

        try {
            // Call the mock verification function from the new utility file
            const result = await authService.verifyOtp({ 
                email, 
                otp, 
                account_number, 
                username, 
                fintech, 
                phoneNo 
            });

            if (result.success) {
                setMessage(result.message || 'OTP verified successfully!');
                setMessageType('success');
                setIsVerified(true);
                if (onOtpVerified) {
                    onOtpVerified(result.user); // Pass user data if available
                }
            } else {
                setMessage(result.message || 'OTP verification failed. Please try again.');
                setMessageType('error');
                setIsVerified(false);
                if (onOtpVerificationFailed) {
                    onOtpVerificationFailed(result.message);
                }
            }
        } catch (error) {
            console.error('Error during OTP verification:', error);
            setMessage('An unexpected error occurred during verification.');
            setMessageType('error');
            setIsVerified(false);
            if (onOtpVerificationFailed) {
                onOtpVerificationFailed(error.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-sm mx-auto my-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">OTP Verification</h3>
            
            {/* Display message */}
            {message && (
                <div className={`p-3 mb-4 rounded-md text-sm font-medium 
                    ${messageType === 'success' ? 'bg-green-100 text-green-700' : ''}
                    ${messageType === 'error' ? 'bg-red-100 text-red-700' : ''}
                    ${messageType === 'info' ? 'bg-blue-100 text-blue-700' : ''}
                `}>
                    {message}
                </div>
            )}

            {/* OTP Input */}
            <div className="mb-4">
                <label htmlFor="otpInput" className="block text-sm font-medium text-gray-700 mb-2">
                    Enter OTP
                </label>
                <input
                    type="text"
                    id="otpInput"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    placeholder="XXXXXX"
                    maxLength="6"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={isLoading || isVerified}
                    inputMode="numeric" // Suggest numeric keyboard on mobile
                    pattern="\d{6}" // HTML5 validation pattern
                    aria-label="OTP Input"
                />
            </div>

            {/* Verify Button */}
            <button
                onClick={handleVerifyOtp}
                disabled={isLoading || isVerified || otp.length !== 6}
                className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-colors duration-200 
                    ${isLoading || isVerified || otp.length !== 6
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    }`}
            >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
            </button>

            {/* Optional: Display email for context */}
            {email && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                    OTP sent to: <span className="font-medium">{email}</span>
                </p>
            )}
        </div>
    );
};


// Main App component to demonstrate the OtpValidation component
const App = () => {
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [userData, setUserData] = useState(null);
    const email = "user@example.com"; // Example email for the component

    const handleOtpVerified = (user) => {
        console.log('OTP Verified successfully!', user);
        setUserData(user);
        setIsOtpVerified(true);
    };

    const handleOtpVerificationFailed = (error) => {
        console.error('OTP Verification Failed:', error);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center font-['Inter'] p-4">
            <div className="w-full">
                {isOtpVerified ? (
                    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md text-center">
                        <h2 className="text-3xl font-bold text-green-600 mb-4">Verification Complete!</h2>
                        <p className="text-gray-700">Welcome, {userData?.username || userData?.email}!</p>
                        <p className="text-gray-500 mt-2">You can now proceed.</p>
                    </div>
                ) : (
                    <OtpValidation
                        email={email}
                        username="testuser"
                        onOtpVerified={handleOtpVerified}
                        onOtpVerificationFailed={handleOtpVerificationFailed}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
