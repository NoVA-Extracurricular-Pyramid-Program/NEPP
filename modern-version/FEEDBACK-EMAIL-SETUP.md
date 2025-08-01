# NEPP Feedback Email Setup Guide

## Current Status
✅ **Fixed**: The feedback form undefined field error has been resolved
✅ **Added**: Feedback data now includes email notification settings

## To Enable Automatic Email Notifications

### Option 1: Firebase Cloud Functions (Recommended)
1. **Install Firebase CLI tools**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Navigate to functions directory**:
   ```bash
   cd functions
   npm install
   ```

3. **Configure Gmail for sending emails**:
   - Go to nepp.advisors@gmail.com account settings
   - Enable 2-factor authentication if not already enabled
   - Generate an App Password for "Mail"
   - Replace `YOUR_16_CHAR_APP_PASSWORD` in `functions/index.js` with the generated password
   - The email will be sent from nepp.advisors@gmail.com to nepp.advisors@gmail.com

4. **Deploy the Cloud Function**:
   ```bash
   firebase deploy --only functions
   ```

### Option 2: Manual Email Monitoring (Immediate Solution)
Until Cloud Functions are set up, you can manually monitor feedback:

1. Go to [Firebase Console](https://console.firebase.google.com/project/nepp-82074/firestore)
2. Navigate to Firestore Database
3. Monitor the `feedback` collection for new entries
4. Manually email important feedback to `nepp.advisors@gmail.com`

## Testing the Fixed Feedback Form

1. Go to `http://localhost:5000/html/settings.html`
2. Scroll to the feedback section
3. Fill out the form:
   - Choose feedback type
   - Add subject and message
   - Optionally include user info
4. Submit feedback

The form should now work without the "undefined" error!

## Firebase Rules
The current Firestore rules allow authenticated users to create feedback entries, which is perfect for this functionality.
