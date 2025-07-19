import { auth, db } from '/config/firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Wait for auth state before loading
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const displayName = user.displayName || "NEPP User";
    document.getElementById('sidebar-user-name').textContent = displayName;
    loadAnnouncements();
  } else {
    window.location.href = '/login.html';
  }
});

async function loadAnnouncements() {
  try {
    console.log('Loading announcements...');
    const querySnapshot = await getDocs(collection(db, "announcements"));
    const announcements = [];
    querySnapshot.forEach(doc => {
      announcements.push({ id: doc.id, ...doc.data() });
    });
    console.log('Announcements loaded:', announcements);
    displayAnnouncements(announcements);
  } catch (error) {
    console.error('Error loading announcements:', error);
  }
}

function displayAnnouncements(announcements) {
  const container = document.querySelector('.announcements-list');
  if (!container) {
    console.error('Announcements container not found');
    return;
  }

  container.innerHTML = announcements.length 
    ? '' 
    : '<div style="color:#aaa;">No announcements yet.</div>';

  announcements.forEach(announcement => {
    const el = document.createElement('div');
    el.className = 'announcement-item';
    el.innerHTML = `
      <strong>${announcement.message}</strong><br>
      <span class="announcement-author">By: ${announcement.author || 'Anonymous'}</span>
      <span class="announcement-time">${announcement.time ? new Date(announcement.time.toDate()).toLocaleDateString() : 'Unknown date'}</span>
    `;
    container.appendChild(el);
  });
}

// Handle announcement creation
const createBtn = document.querySelector('.create-announcement');
const popup = document.querySelector('.announcement-popup');
const submitBtn = document.querySelector('.popup-submit');
const cancelBtn = document.querySelector('.popup-cancel');
const messageInput = document.querySelector('.popup-message');
const errorDisplay = document.querySelector('.popup-error');

if (createBtn) {
  createBtn.addEventListener('click', () => {
    popup.style.display = 'flex';
  });
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    popup.style.display = 'none';
    messageInput.value = '';
    errorDisplay.textContent = '';
  });
}

if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    if (!message) {
      errorDisplay.textContent = 'Please enter an announcement message';
      return;
    }

    try {
      await addDoc(collection(db, "announcements"), {
        message,
        author: auth.currentUser.displayName,
        authorId: auth.currentUser.uid,
        time: serverTimestamp()
      });

      popup.style.display = 'none';
      messageInput.value = '';
      errorDisplay.textContent = '';
      loadAnnouncements(); // Reload the announcements
    } catch (error) {
      console.error('Error creating announcement:', error);
      errorDisplay.textContent = 'Failed to create announcement. Please try again.';
    }
  });
}

// Close popup when clicking outside
popup?.addEventListener('click', (e) => {
  if (e.target === popup) {
    popup.style.display = 'none';
    messageInput.value = '';
    errorDisplay.textContent = '';
  }
});