import { auth, db } from '/config/firebase-config.js';
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

let currentUser = null;

// Initialize profile page
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserProfile();
    setupEventListeners();
    displayUserInfo();
  } else {
    window.location.href = '/login.html';
  }
});

// Display user info in sidebar
function displayUserInfo() {
  if (currentUser) {
    const userEmail = currentUser.email;
    const displayName = currentUser.displayName || userEmail.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();

    // Update sidebar
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userEmail').textContent = userEmail;
    document.getElementById('userInitial').textContent = initial;

    // Update profile section
    document.getElementById('profileDisplayName').textContent = displayName;
    document.getElementById('profileEmail').textContent = userEmail;
    document.getElementById('profileInitial').textContent = initial;

    // Set member since date
    const memberSince = currentUser.metadata.creationTime ? 
      new Date(currentUser.metadata.creationTime).toLocaleDateString() : 'Unknown';
    document.getElementById('memberSince').textContent = memberSince;
  }
}

// Load user profile data
async function loadUserProfile() {
  try {
    // Load user document from Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Populate form fields
      document.getElementById('displayName').value = userData.displayName || currentUser.displayName || '';
      document.getElementById('email').value = currentUser.email;
      document.getElementById('bio').value = userData.bio || '';
    } else {
      // Set default values
      document.getElementById('displayName').value = currentUser.displayName || '';
      document.getElementById('email').value = currentUser.email;
      document.getElementById('bio').value = '';
    }

    // Load statistics and activity
    await Promise.all([
      loadUserStatistics(),
      loadRecentActivity()
    ]);

  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Load user statistics
async function loadUserStatistics() {
  try {
    // Forms created by user
    const formsQuery = query(
      collection(db, 'forms'),
      where('createdBy', '==', currentUser.uid)
    );
    const formsSnapshot = await getDocs(formsQuery);
    document.getElementById('formsCreated').textContent = formsSnapshot.size;

    // Forms bookmarked by user
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const bookmarkedForms = userDoc.exists() ? (userDoc.data().bookmarkedForms || []) : [];
    document.getElementById('formsBookmarked').textContent = bookmarkedForms.length;

    // Responses received (on user's forms)
    let responsesReceived = 0;
    for (const formDoc of formsSnapshot.docs) {
      const responsesQuery = query(collection(db, 'forms', formDoc.id, 'responses'));
      const responsesSnapshot = await getDocs(responsesQuery);
      responsesReceived += responsesSnapshot.size;
    }
    document.getElementById('responsesReceived').textContent = responsesReceived;

    // Responses submitted by user
    const allFormsSnapshot = await getDocs(collection(db, 'forms'));
    let responsesSubmitted = 0;
    
    for (const formDoc of allFormsSnapshot.docs) {
      const userResponseQuery = query(
        collection(db, 'forms', formDoc.id, 'responses'),
        where('userId', '==', currentUser.uid)
      );
      const userResponseSnapshot = await getDocs(userResponseQuery);
      responsesSubmitted += userResponseSnapshot.size;
    }
    document.getElementById('responsesSubmitted').textContent = responsesSubmitted;

  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

// Load recent activity
async function loadRecentActivity() {
  try {
    const activityContainer = document.getElementById('recentActivity');
    const activities = [];

    // Get recent forms created
    const recentFormsQuery = query(
      collection(db, 'forms'),
      where('createdBy', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const recentFormsSnapshot = await getDocs(recentFormsQuery);
    
    recentFormsSnapshot.forEach(doc => {
      const form = doc.data();
      activities.push({
        type: 'form_created',
        title: 'Created a new form',
        description: form.title,
        time: form.createdAt.toDate(),
        icon: 'plus'
      });
    });

    // Sort activities by time
    activities.sort((a, b) => b.time - a.time);

    if (activities.length === 0) {
      activityContainer.innerHTML = '<div class="loading-state">No recent activity found.</div>';
      return;
    }

    // Display activities
    activityContainer.innerHTML = activities.slice(0, 10).map(activity => `
      <div class="activity-item">
        <div class="activity-icon">
          ${getActivityIcon(activity.type)}
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
          <div class="activity-time">${formatRelativeTime(activity.time)}</div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading recent activity:', error);
    document.getElementById('recentActivity').innerHTML = 
      '<div class="loading-state">Error loading recent activity.</div>';
  }
}

// Get activity icon based on type
function getActivityIcon(type) {
  switch (type) {
    case 'form_created':
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>`;
    case 'response_submitted':
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>`;
  }
}

// Format relative time
function formatRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return date.toLocaleDateString();
}

// Setup event listeners
function setupEventListeners() {
  // Save profile button
  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
  
  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Delete account button
  document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);
}

// Save profile changes
async function saveProfile() {
  try {
    const displayName = document.getElementById('displayName').value.trim();
    const bio = document.getElementById('bio').value.trim();
    
    // Update Firebase Auth profile
    if (displayName !== currentUser.displayName) {
      await updateProfile(currentUser, { displayName });
    }
    
    // Update Firestore user document
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(userDocRef, {
      displayName,
      bio,
      email: currentUser.email,
      updatedAt: new Date()
    }, { merge: true });
    
    // Update display
    displayUserInfo();
    
    // Show success message
    const button = document.getElementById('saveProfileBtn');
    const originalText = button.innerHTML;
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Saved!
    `;
    button.style.background = '#28a745';
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = '';
    }, 2000);
    
  } catch (error) {
    console.error('Error saving profile:', error);
    alert('Error saving profile. Please try again.');
  }
}

// Logout function
async function logout() {
  try {
    await auth.signOut();
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Error signing out:', error);
    alert('Error signing out. Please try again.');
  }
}

// Delete account function
async function deleteAccount() {
  const confirmed = confirm(
    'Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all your forms, responses, and data.'
  );
  
  if (confirmed) {
    const doubleConfirmed = confirm(
      'This is your final warning. Deleting your account will remove all your data permanently. Type "DELETE" to confirm.'
    );
    
    if (doubleConfirmed) {
      try {
        // Here you would typically:
        // 1. Delete user's forms and responses from Firestore
        // 2. Delete user document from Firestore  
        // 3. Delete the user's authentication account
        
        alert('Account deletion is not yet implemented. Please contact support for account deletion.');
        
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account. Please contact support.');
      }
    }
  }
}
