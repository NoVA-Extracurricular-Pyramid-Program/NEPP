import { AuthService } from '/services/auth-service.js';
import { UIUtils } from '/utils/ui-utils.js';
import { CONSTANTS } from '/config/constants.js';
import { auth, db } from '/config/firebase-config.js';
import { 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Handle navigation UI
const loginLink = document.getElementById('login-link');
const logoutLink = document.getElementById('logout-link');
const profileLink = document.getElementById('profile-link');

if (loginLink && logoutLink && profileLink) {
  onAuthStateChanged(auth, (user) => {
    loginLink.style.display = user ? 'none' : 'block';
    logoutLink.style.display = user ? 'block' : 'none';
    profileLink.style.display = user ? 'block' : 'none';
  });

  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  });
}

// Login form handling
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const authMessage = document.getElementById('auth-message');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'dashboard.html';
    } catch (error) {
      authMessage.textContent = error.message;
      authMessage.style.color = '#ff3860';
      authMessage.style.display = 'block';
    }
  });
}

// Update the signup handler with better error logging
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const authMessage = document.getElementById('auth-message');

    if (password !== confirmPassword) {
      authMessage.textContent = 'Passwords do not match';
      authMessage.style.color = '#ff3860';
      authMessage.style.display = 'block';
      return;
    }

    try {
      // Create the user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('User created successfully:', userCredential.user.uid);
      
      // Update the user's display name
      await updateProfile(userCredential.user, {
        displayName: name
      });
      console.log('Profile updated successfully');

      // Create the user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        displayName: name,
        email: email,
        createdAt: new Date().toISOString()
      });
      console.log('Firestore document created successfully');

      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Signup error:', error);
      authMessage.textContent = `Error: ${error.code} - ${error.message}`;
      authMessage.style.color = '#ff3860';
      authMessage.style.display = 'block';
    }
  });
}

// Add user settings interface
const createUserSettings = async (userId) => {
  await setDoc(doc(db, 'userSettings', userId), {
    theme: 'dark',
    notifications: true,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  });
};

// Enhanced user registration
const registerUser = async (email, password, displayName) => {
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile
    await updateProfile(user, { displayName });

    // Create user document
    await setDoc(doc(db, 'users', user.uid), {
      displayName,
      email,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });

    // Create user settings
    await createUserSettings(user.uid);

    return user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Google Sign-in
const googleProvider = new GoogleAuthProvider();
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // Create user document for new Google users
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      await createUserSettings(user.uid);
    }

    return user;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

// Profile page logic (change password etc.)
const changePasswordBtn = document.getElementById('change-password-btn');
if (changePasswordBtn) {
  changePasswordBtn.addEventListener('click', function() {
    const user = auth.currentUser;
    if (user) {
      sendPasswordResetEmail(auth, user.email).then(function() {
        alert('Password reset email sent! Check your inbox to reset your password.');
      }).catch(function(error) {
        alert('Error: ' + error.message);
      });
    }
  });
}

const updateProfileBtn = document.getElementById('update-profile-btn');
if (updateProfileBtn) {
  updateProfileBtn.addEventListener('click', function() {
    alert('Profile update functionality coming soon!');
  });
}

// Logout handling
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  });
}

// Google Sign In
const googleSignInButton = document.getElementById('googleSignIn');
if (googleSignInButton) {
  googleSignInButton.addEventListener('click', async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user document exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create new user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          username: user.displayName,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }

      // Redirect to dashboard
      window.location.href = '/dashboard.html';
    } catch (error) {
      console.error('Error signing in with Google:', error);
      const authMessage = document.getElementById('auth-message');
      if (authMessage) {
        authMessage.style.display = 'block';
        authMessage.style.backgroundColor = '#ff3860';
        authMessage.style.color = 'white';
        authMessage.textContent = error.message;
      }
    }
  });
}