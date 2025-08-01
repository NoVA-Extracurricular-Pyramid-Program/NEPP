import { auth, db } from '/config/firebase-config.js';
import { 
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  deleteUser,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, updateDoc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// UI Elements
const profileStatus = document.getElementById('profileStatus');
const authButton = document.getElementById('authButton');
const updateBtn = document.getElementById('updateProfile');
const formInputs = document.querySelectorAll('.profile-form input:not([disabled])');

// Handle Authentication State
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    profileStatus.textContent = 'Make sure your information below is up to date.';
    authButton.textContent = 'Sign Out';
    updateBtn.disabled = false;
    formInputs.forEach(input => input.disabled = false);
    loadUserData();
  } else {
    // User is signed out
    profileStatus.textContent = 'You are currently signed out.';
    authButton.textContent = 'Sign In';
    updateBtn.disabled = true;
    formInputs.forEach(input => {
      input.disabled = true;
      input.value = '';
    });
    document.getElementById('userEmail').value = '';
  }
});

// Auth Button Click Handler
authButton?.addEventListener('click', async () => {
  if (auth.currentUser) {
    // Sign out
    try {
      await signOut(auth);
      window.location.href = '/login.html';
    } catch (error) {
      alert('Error signing out: ' + error.message);
    }
  } else {
    // Redirect to login
    window.location.href = '/login.html';
  }
});

// Load user data
async function loadUserData() {
  const user = auth.currentUser;
  if (user) {
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();

    document.getElementById('fullName').value = user.displayName || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('username').value = userData?.username || user.displayName || '';
  }
}

// Theme handling
const themeSelector = document.getElementById('themeSelector');
themeSelector?.addEventListener('change', async (e) => {
  const theme = e.target.value;
  document.body.className = theme;
  if (auth.currentUser) {
    await updateDoc(doc(db, 'userSettings', auth.currentUser.uid), {
      theme,
      lastUpdated: new Date().toISOString()
    });
  }
});

// Update Profile
const passwordModal = document.getElementById('passwordModal');
const confirmBtn = document.getElementById('confirmPassword');
const cancelBtn = document.getElementById('cancelPassword');

updateBtn?.addEventListener('click', () => {
  passwordModal.style.display = 'flex';
});

cancelBtn?.addEventListener('click', () => {
  passwordModal.style.display = 'none';
  document.getElementById('currentPassword').value = '';
});

confirmBtn?.addEventListener('click', async () => {
  const currentPassword = document.getElementById('currentPassword').value;
  const newName = document.getElementById('fullName').value;
  const newUsername = document.getElementById('username').value;

  try {
    // First reauthenticate
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword
    );
    await reauthenticateWithCredential(auth.currentUser, credential);

    // Then update profile
    await updateProfile(auth.currentUser, {
      displayName: newName
    });

    // Update in Firestore
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      displayName: newName,
      username: newUsername,
      lastUpdated: new Date().toISOString()
    });

    passwordModal.style.display = 'none';
    document.getElementById('currentPassword').value = '';
    alert('Profile updated successfully!');
  } catch (error) {
    alert('Error updating profile: ' + error.message);
  }
});

// Password reset
const resetPasswordBtn = document.getElementById('resetPassword');
resetPasswordBtn?.addEventListener('click', async () => {
  try {
    await sendPasswordResetEmail(auth, auth.currentUser.email);
    alert('Password reset email sent!');
  } catch (error) {
    alert('Error sending reset email: ' + error.message);
  }
});

// Account deletion
const deleteAccountBtn = document.getElementById('deleteAccount');
deleteAccountBtn?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
    try {
      await deleteUser(auth.currentUser);
      window.location.href = '/login.html';
    } catch (error) {
      alert('Error deleting account: ' + error.message);
    }
  }
});

// Feedback System
const sendFeedbackBtn = document.getElementById('sendFeedback');
const feedbackType = document.getElementById('feedbackType');
const feedbackSubject = document.getElementById('feedbackSubject');
const feedbackMessage = document.getElementById('feedbackMessage');
const includeUserInfo = document.getElementById('includeUserInfo');

sendFeedbackBtn?.addEventListener('click', async () => {
  if (!auth.currentUser) {
    alert('Please sign in to send feedback.');
    return;
  }

  const type = feedbackType.value;
  const subject = feedbackSubject.value.trim();
  const message = feedbackMessage.value.trim();

  if (!subject || !message) {
    alert('Please fill in both subject and message fields.');
    return;
  }

  try {
    sendFeedbackBtn.disabled = true;
    sendFeedbackBtn.textContent = 'Sending...';

    const feedbackData = {
      type: type,
      subject: subject,
      message: message,
      userId: auth.currentUser.uid,
      userEmail: auth.currentUser.email,
      createdAt: serverTimestamp(),
      status: 'new',
      // Email notification settings
      notifyEmail: 'nepp.advisors@gmail.com',
      emailNotificationSent: false
    };

    // Include user info if requested
    if (includeUserInfo.checked) {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userInfo = {};
          
          // Only include fields that exist, are not null, and are not undefined
          if (userData.displayName !== undefined && userData.displayName !== null && userData.displayName !== '') {
            userInfo.displayName = userData.displayName;
          }
          if (userData.role !== undefined && userData.role !== null && userData.role !== '') {
            userInfo.role = userData.role;
          }
          if (userData.department !== undefined && userData.department !== null && userData.department !== '') {
            userInfo.department = userData.department;
          }
          if (userData.username !== undefined && userData.username !== null && userData.username !== '') {
            userInfo.username = userData.username;
          }
          
          // Only add userInfo to feedbackData if we have at least one valid field
          if (Object.keys(userInfo).length > 0) {
            feedbackData.userInfo = userInfo;
          }
        }
      } catch (error) {
        console.warn('Could not retrieve user info:', error);
        // Don't include userInfo if there's an error
      }
    }

    // Save feedback to Firestore
    await addDoc(collection(db, 'feedback'), feedbackData);

    // Reset form
    feedbackSubject.value = '';
    feedbackMessage.value = '';
    includeUserInfo.checked = false;
    feedbackType.value = 'bug';

    alert('Thank you for your feedback! We appreciate your input and will review it soon. Your feedback has been saved to our system.');

  } catch (error) {
    console.error('Error sending feedback:', error);
    alert('Error sending feedback. Please try again or contact support directly.');
  } finally {
    sendFeedbackBtn.disabled = false;
    sendFeedbackBtn.textContent = 'Send Feedback';
  }
});

// Load user data when page loads
document.addEventListener('DOMContentLoaded', loadUserData);