// utils/emailService.js
// Utility for sending emails via the backend API: https://techvibs.com/bank/api_general/function_email_service.php

const EMAIL_SERVICE_API_URL = 'https://techvibs.com/bank/api_general/function_email_service.php';

/**
 * Sends an email using the backend email service API.
 *
 * @param {string} toEmail - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} body - The content of the email. Can be HTML or plain text.
 * @param {boolean} [isHtml=true] - Whether the email body should be treated as HTML. Defaults to true.
 * @returns {Promise<{success: boolean, message: string}>} - An object indicating success status and a message.
 */
export async function sendEmail({ toEmail, subject, body, isHtml = true }) {
  try {
    // Construct the payload matching the PHP API's expected input
    const payload = {
      to_email: toEmail,
      subject: subject,
      body: body,
      is_html: isHtml,
    };

    // Make the POST request to the email service API
    const response = await fetch(EMAIL_SERVICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Indicate that we are sending JSON
      },
      body: JSON.stringify(payload), // Convert the JavaScript object to a JSON string
    });

    // Parse the JSON response from the PHP API
    const data = await response.json();

    // The PHP API returns { success: boolean, message: string }
    // We can directly return this structure.
    // Check if the HTTP response itself was okay (status 200-299)
    // and then check the 'success' flag in the JSON response.
    if (response.ok && data.success) {
      return { success: true, message: data.message || 'Email sent successfully.' };
    } else {
      // If response.ok is false (e.g., 4xx, 5xx status) or data.success is false
      return { success: false, message: data.message || 'Failed to send email: An unknown error occurred.' };
    }
  } catch (error) {
    // Catch any network errors or issues with the fetch operation
    console.error('Network or API error when sending email:', error);
    return { success: false, message: `Network error: Could not connect to email service. ${error.message}` };
  }
}

// Example usage (for testing purposes, you would call this from your React Native components)
/*
// In a React Native component:
import { sendEmail } from '../utils/emailService'; // Adjust path as needed

const handleSendTestEmail = async () => {
  const result = await sendEmail({
    toEmail: 'test@example.com',
    subject: 'Test Email from React Native',
    body: '<p>Hello from <strong>React Native</strong>!</p>',
    isHtml: true,
  });

  if (result.success) {
    Alert.alert('Email Sent', result.message);
  } else {
    Alert.alert('Email Failed', result.message);
  }
};
*/
