// auth.js - Authentication utility for NEPP website
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Function to update navigation based on authentication state
export function setupAuth() {
  // Find navigation elements
  const loginLink = document.getElementById('login-link');
  const logoutLink = document.getElementById('logout-link');
  const profileLink = document.getElementById('profile-link');
  
  if (!loginLink || !logoutLink) {
    console.error('Navigation elements not found');
    return;
  }
  
  // Handle authentication state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in
      loginLink.style.display = 'none';
      logoutLink.style.display = 'block';
      if (profileLink) profileLink.style.display = 'block';
    } else {
      // User is signed out
      loginLink.style.display = 'block';
      logoutLink.style.display = 'none';
      if (profileLink) profileLink.style.display = 'none';
    }
  });
  
  // Handle logout
  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      // No need to redirect, the auth state change will update the UI
    } catch (error) {
      console.error('Error signing out:', error);
    }
  });
} 