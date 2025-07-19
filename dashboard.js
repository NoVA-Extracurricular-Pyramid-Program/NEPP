import { auth, db } from '/config/firebase-config.js';
import { FormsService } from '/services/forms-service.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { AnnouncementService } from '/services/announcement-service.js';
import { UIUtils } from './utils/ui-utils.js';
import { CONSTANTS } from './config/constants.js';
import { UserSelector } from './components/user-selector.js';

// Wait for auth state before trying to load data
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      console.log('User authenticated, loading data...');
      await displayForms();
      await displayAnnouncements();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
});

// UI: Set sidebar and header user name
onAuthStateChanged(auth, (user) => {
  const displayName = user?.displayName || CONSTANTS.UI.DEFAULT_USER_NAME;
  document.getElementById('sidebar-user-name').textContent = displayName;
  document.getElementById('user-display-name').textContent = displayName;
});

// Initialize user selector
const userSelector = new UserSelector('formUserSelector');

// Forms Logic
document.getElementById('createFormBtn').onclick = () => UIUtils.toggleModal('formModal', true);
document.getElementById('closeFormModal').onclick = () => {
  UIUtils.toggleModal('formModal', false);
  UIUtils.clearFormFields(['formTitle', 'formDueDate', 'formAssignedTo', 'formAssignedBy', 'formDescription']);
};

document.getElementById('saveFormBtn').onclick = async () => {
  const formData = {
    title: document.getElementById('formTitle').value.trim(),
    dueDate: document.getElementById('formDueDate').value,
    description: document.getElementById('formDescription').value.trim(),
    isPublic: document.getElementById('formIsPublic').checked,
    targetUsers: userSelector.getSelectedUsers(),
    createdBy: auth.currentUser.uid
  };

  if (!formData.title || !formData.dueDate || !formData.description) {
    alert("Please fill in all required fields.");
    return;
  }

  await FormsService.create(formData);
  UIUtils.toggleModal('formModal', false);
  UIUtils.clearFormFields(['formTitle', 'formDueDate', 'formDescription']);
  userSelector.clear();
  displayForms();
};

async function displayForms() {
  try {
    console.log('Fetching forms...');
    const forms = await FormsService.getAll(auth.currentUser.uid);
    console.log('Forms fetched:', forms);
    
    const container = document.getElementById('formsList');
    container.innerHTML = forms.length ? '' : '<div style="color:#aaa;">No forms yet.</div>';
    
    forms.forEach(form => {
      const el = document.createElement('div');
      el.className = 'form-item';
      el.innerHTML = `
        <strong>${form.title}</strong> 
        <span class="form-visibility">${form.isPublic ? '🌎 Public' : '👥 Targeted'}</span>
        <span style="color:#bbccff;">(Due: ${form.dueDate})</span><br>
        <p>${form.description}</p>
      `;
      container.appendChild(el);
    });
  } catch (error) {
    console.error('Error displaying forms:', error);
  }
}

async function displayAnnouncements() {
  try {
    console.log('Fetching announcements...');
    const querySnapshot = await getDocs(collection(db, "announcements"));
    const announcements = [];
    querySnapshot.forEach(doc => announcements.push({ id: doc.id, ...doc.data() }));
    console.log('Announcements fetched:', announcements);

    const container = document.getElementById('announcementsList');
    container.innerHTML = announcements.length ? '' : '<div style="color:#aaa;">No announcements yet.</div>';
    
    announcements.forEach(announcement => {
      const el = document.createElement('div');
      el.className = 'announcement-item';
      el.innerHTML = `
        <strong>${announcement.message}</strong><br>
        <span class="announcement-author">By: ${announcement.author || 'Anonymous'}</span>
        <span class="announcement-time">${new Date(announcement.time).toLocaleDateString()}</span>
      `;
      container.appendChild(el);
    });
  } catch (error) {
    console.error('Error displaying announcements:', error);
  }
}

// Modal click outside handler
window.onclick = function(event) {
  if (event.target === document.getElementById('formModal')) {
    UIUtils.toggleModal('formModal', false);
    UIUtils.clearFormFields(['formTitle', 'formDueDate', 'formAssignedTo', 'formAssignedBy', 'formDescription']);
  }
};