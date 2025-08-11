// Utility functions for requesting OTP, confirming PIN or password, and completing credential reset

const RESET_API_URL = 'https://techvibs.com/bank/api_general/reset_credentials_api.php';
const PIN_VERIFY_API_URL = 'https://techvibs.com/bank/api_general/loginVerify_createSession_userDataShare.php';

// Request OTP for password or pin reset
export async function requestCredentialResetOTP({ type, user_identifier }) {
  try {
    const resp = await fetch(RESET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_reset',
        type,
        user_identifier,
      }),
    });
    const json = await resp.json();
    return json;
  } catch (error) {
    return { success: false, message: 'Network error', error };
  }
}

// Confirm PIN or password for the user using the loginVerify_createSession_userDataShare.php API
export async function confirmPin({ user_identifier, pin, password }) {
  try {
    // Support both PIN and password confirmation
    const payload = {
      action: 'login',
    };
    // Guess if identifier is numeric (account number) or not (username)
    if (/^\d+$/.test(user_identifier)) {
      payload.account_number = user_identifier;
    } else {
      payload.username = user_identifier;
    }
    if (password) {
      payload.password = password;
    } else if (pin) {
      payload.pin = pin;
    } else {
      return { success: false, message: 'No PIN or password provided' };
    }
    const resp = await fetch(PIN_VERIFY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    // status: "success" if PIN or password is valid
    if (json.status === 'success') {
      return { success: true };
    } else {
      return { success: false, message: json.message || 'Incorrect PIN/password' };
    }
  } catch (error) {
    return { success: false, message: 'Network error', error };
  }
}

// Complete the reset (verify OTP and set new credential)
export async function completeCredentialReset({ type, user_identifier, otp, new_credential, pin }) {
  try {
    const resp = await fetch(RESET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset',
        type,
        user_identifier,
        otp,
        new_credential,
        pin,
      }),
    });
    const json = await resp.json();
    return json;
  } catch (error) {
    return { success: false, message: 'Network error', error };
  }
}