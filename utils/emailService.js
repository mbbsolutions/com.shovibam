// utils/emailService.js
import allowedFintechs from './allowedFintechs.json';
import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system'; // Import FileSystem for reading local assets

// Assuming 'logo.png' is located at 'assets/logo.png'
const localLogoAsset = require('../assets/logo.png'); 

const EMAIL_SERVICE_API_URL = 'https://techvibs.com/bank/api_general/function_email_service.php';

// Assume the first fintech in the list is the default sender
const DEFAULT_FINTECH = allowedFintechs[0] || 'Shovibam'; // Fallback to 'Shovibam' if list is empty

/**
 * Creates the branded HTML email header with logo and current date/time.
 * The img src uses 'cid:logo@techvibs' for embedded image referencing.
 * @param {string} fintechName - The name of the fintech/company.
 * @returns {string} The HTML string for the email header.
 */
const _createEmailHeader = (fintechName) => `
  <div style="
    background: #f8f8f8;
    padding: 15px;
    border-bottom: 2px solid #e0e0e0;
    margin-bottom: 20px;
  ">
    <!-- Using local logo asset embedded via CID -->
    <img src="cid:logo@techvibs" alt="${fintechName} Logo" 
         style="height: 40px; margin-bottom: 10px; display: block;">
    <p style="color: #666; margin: 5px 0; font-size: 12px;">
      ${new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}
    </p>
  </div>`;

/**
 * Core email sending function. It now converts local logo to base64 for embedding.
 *
 * @param {string} toEmail - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} body - The content of the email. Can be HTML or plain text.
 * @param {boolean} [isHtml=true] - Whether the email body should be treated as HTML. Defaults to true.
 * @param {string} [fintechOrigin=DEFAULT_FINTECH] - The name of the fintech/company sending the email.
 */
const _sendEmail = async ({ 
  toEmail, 
  subject, 
  body, 
  isHtml = true, 
  fintechOrigin = DEFAULT_FINTECH }) => {
  try {
    const fintech = allowedFintechs.includes(fintechOrigin) ? fintechOrigin : 'Unknown Service';

    let logoBase64 = '';
    let logoMimeType = 'image/png'; // Default MIME type

    // Read the local logo file and convert to base64 using expo-file-system
    try {
      const resolvedAsset = Image.resolveAssetSource(localLogoAsset);
      if (resolvedAsset && resolvedAsset.uri) {
        // Use FileSystem.readAsStringAsync for reading local files in Expo
        logoBase64 = await FileSystem.readAsStringAsync(resolvedAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Determine MIME type from file extension (or if available from resolvedAsset.type)
        const uriExtension = resolvedAsset.uri.split('.').pop().toLowerCase();
        if (uriExtension === 'png') {
          logoMimeType = 'image/png';
        } else if (uriExtension === 'jpg' || uriExtension === 'jpeg') {
          logoMimeType = 'image/jpeg';
        } else if (uriExtension === 'gif') {
          logoMimeType = 'image/gif';
        }
        // Fallback to resolvedAsset.type if available and more accurate
        logoMimeType = resolvedAsset.type || logoMimeType;

        console.log("Logo converted to Base64 successfully using FileSystem.");
      } else {
        console.warn("Could not resolve local logo asset URI for Base64 conversion.");
      }
    } catch (error) {
      console.error('Error converting local logo to Base64 with FileSystem:', error);
      // Email will still be attempted without the logo if conversion fails
    }

    let brandedEmailContent;
    if (isHtml) {
      brandedEmailContent = `
        ${_createEmailHeader(fintech)}
        <div style="padding: 0 15px;">
          ${body}
        </div>
        <div style="
          margin-top: 30px;
          padding: 15px;
          background: #f8f8f8;
          font-size: 12px;
          color: #666;
          text-align: center;
        ">
          <p>This message was sent to you by <strong>${fintech}</strong></p>
          <p>© ${new Date().getFullYear()} ${fintech}. All rights reserved.</p>
        </div>
      `;
    } else {
      brandedEmailContent = `
        ${fintech} Notification
        ${new Date().toLocaleString()}
        ----------------------------
        ${body}
        
        ---
        This message was sent to you by ${fintech}
        © ${new Date().getFullYear()} ${fintech}. All rights reserved.
      `;
    }

    const payload = {
      to_email: toEmail,
      subject: `${fintech} - ${subject}`, // Prepend fintech name to subject
      body: brandedEmailContent,
      is_html: isHtml,
      attachment_data: [] // Initialize as empty array
    };

    // Only add attachment_data if logoBase64 was successfully generated
    if (logoBase64) {
      payload.attachment_data.push({
        filename: 'logo.png', // Or dynamic filename if needed
        content: logoBase64,
        cid: 'logo@techvibs', // This CID must match the img src in _createEmailHeader
        type: logoMimeType // Use the determined MIME type
      });
    }

    const response = await fetch(EMAIL_SERVICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Handle non-OK HTTP responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
      return { success: false, message: `Failed to send email: HTTP error ${response.status}.` };
    }

    const data = await response.json();
    
    // Check API response success flag
    return data.success 
      ? { success: true, message: data.message || 'Email sent successfully.' }
      : { success: false, message: data.message || 'Failed to send email: Unknown API error.' };

  } catch (error) {
    console.error('Email service operation failed:', error);
    return { success: false, message: `Email service error: ${error.message}` };
  }
};

/**
 * Custom hook for email services.
 * This hook is designed to be used within React components to access email sending functionality.
 */
export const useEmailService = () => {
  const sendEmail = _sendEmail;

  /**
   * Creates a pre-configured email sender for a specific user.
   *
   * @param {string} userEmail - The email address of the user.
   * @returns {{send: function} | null} - An object with a `send` method, or `null` if userEmail is not provided.
   */
  const createUserEmailSender = (userEmail) => {
    if (!userEmail) {
      console.warn('No user email provided to createUserEmailSender. Sender not created.');
      return null;
    }

    return {
      /**
       * Sends an email to the `userEmail` configured during `createUserEmailSender` call.
       *
       * @param {object} options - Options for sending the email.
       * @param {string} options.subject - The subject of the email.
       * @param {string} options.body - The HTML or plain text body of the email.
       * @param {boolean} [options.isHtml=true] - Whether the email body should be treated as HTML.
       * @param {string} [options.fintechOrigin=DEFAULT_FINTECH] - The name of the fintech/company. Defaults to DEFAULT_FINTECH.
       * @returns {Promise<{success: boolean, message: string}>}
       */
      send: ({ subject, body, isHtml = true, fintechOrigin = DEFAULT_FINTECH }) => {
        return _sendEmail({
          toEmail: userEmail,
          subject,
          body,
          isHtml,
          fintechOrigin // Ensure fintechOrigin is passed correctly here
        });
      }
    };
  };

  return {
    sendEmail,               // General email sending function (fintechOrigin optional in options)
    createUserEmailSender    // Function to create a user-specific email sender (fintechOrigin optional in returned .send method)
  };
};

// For backward compatibility:
export const sendEmail = _sendEmail;
