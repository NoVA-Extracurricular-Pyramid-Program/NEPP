
import { auth, db } from '/config/firebase-config.js';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  Timestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { initializeAuth } from '/utils/auth-utils.js';

let currentFormType = 'public';
let questions = [];
let formId = null;
let isInitialized = false;

// Get form ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
formId = urlParams.get('id');

if (!formId) {
  window.location.href = 'forms.html';
}

// Initialize auth and load form data
initializeAuth().then(async (authResult) => {
  if (authResult) {
    await loadFormData();
    initializeEventListeners();
  }
}).catch(error => {
  console.error('Authentication error:', error);
  showAuthAlert();
});

function initializeEventListeners() {
  // Initialize form submission
  const form = document.getElementById('editFormForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Initialize cancel button
  const cancelButton = document.getElementById('cancelForm');
  if (cancelButton) {
    cancelButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
        window.location.href = 'forms.html';
      }
    });
  }

  // Initialize question type buttons
  const questionTypeBtns = document.querySelectorAll('.question-type-btn');
  questionTypeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.dataset.type;
      addQuestion(type);
    });
  });

  // Initialize form type toggle
  const publicRadio = document.getElementById('public');
  const privateRadio = document.getElementById('private');
  
  if (publicRadio && privateRadio) {
    publicRadio.addEventListener('change', () => {
      if (publicRadio.checked) {
        currentFormType = 'public';
        document.getElementById('groupSelector').style.display = 'none';
      }
    });

    privateRadio.addEventListener('change', () => {
      if (privateRadio.checked) {
        currentFormType = 'private';
        document.getElementById('groupSelector').style.display = 'block';
      }
    });
  }
}

async function loadFormData() {
  try {
    const formRef = doc(db, 'forms', formId);
    const formSnap = await getDoc(formRef);
    
    if (!formSnap.exists()) {
      alert('Form not found');
      window.location.href = 'forms.html';
      return;
    }

    const formData = formSnap.data();
    
    // Check if user owns this form
    if (formData.createdBy !== auth.currentUser.uid) {
      alert('You do not have permission to edit this form');
      window.location.href = 'forms.html';
      return;
    }

    // Populate form fields
    document.getElementById('formTitle').value = formData.title || '';
    document.getElementById('formDescription').value = formData.description || '';
    
    if (formData.dueDate) {
      const dueDate = formData.dueDate.toDate();
      const localDateTime = new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000);
      document.getElementById('dueDate').value = localDateTime.toISOString().slice(0, 16);
    }

    // Set form type
    currentFormType = formData.type || 'public';
    if (currentFormType === 'private') {
      const privateRadio = document.getElementById('private');
      if (privateRadio) {
        privateRadio.checked = true;
        document.getElementById('groupSelector').style.display = 'block';
        if (formData.group) {
          document.getElementById('group').value = formData.group;
        }
      }
    } else {
      const publicRadio = document.getElementById('public');
      if (publicRadio) {
        publicRadio.checked = true;
      }
    }

    // Load questions
    questions = formData.questions || [];
    const questionsContainer = document.getElementById('questionsContainer');
    questionsContainer.innerHTML = '';
    
    questions.forEach(questionData => {
      addQuestion(questionData.type, questionData);
    });

  } catch (error) {
    console.error('Error loading form data:', error);
    alert('Error loading form: ' + error.message);
    window.location.href = 'forms.html';
  }
}

function showAuthAlert() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  
  const dialog = document.createElement('div');
  dialog.className = 'auth-alert-dialog';
  dialog.innerHTML = `
    <h2>Sign In Required</h2>
    <p>You need to be signed in to edit forms. Would you like to sign in now?</p>
    <div class="auth-alert-actions">
      <button class="sign-in-btn">Sign In</button>
      <button class="cancel-auth-btn">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);

  dialog.querySelector('.sign-in-btn').addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  dialog.querySelector('.cancel-auth-btn').addEventListener('click', () => {
    overlay.remove();
    dialog.remove();
    window.location.href = 'forms.html';
  });
}

// Initialize event listeners and load form data
document.addEventListener('DOMContentLoaded', () => {
  // Set up the auth state listener first
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // User is signed in
      console.log('User is signed in:', user.email);
      await loadFormData();
      initializePage();
    } else {
      // User is not signed in
      console.log('No user is signed in');
      showAuthAlert();
    }
  });
});

function initializePage() {
  if (isInitialized) return;
  
  initializeFormTypeButtons();
  initializeQuestionTypeButtons();
  initializeCancelButton();
  initializeFormSubmission();
  
  isInitialized = true;
}

async function loadFormData() {
  try {
    const formDoc = await getDoc(doc(db, 'forms', formId));
    if (!formDoc.exists()) {
      alert('Form not found');
      window.location.href = 'forms.html';
      return;
    }

    const formData = formDoc.data();
    
    // Populate form fields
    document.getElementById('formTitle').value = formData.title || '';
    document.getElementById('formDescription').value = formData.description || '';
    
    // Handle due date - it might be a Firestore Timestamp or a Date object
    if (formData.dueDate) {
      let dueDateValue;
      if (typeof formData.dueDate.toDate === 'function') {
        // It's a Firestore Timestamp
        dueDateValue = formData.dueDate.toDate().toISOString().slice(0, 16);
      } else if (formData.dueDate instanceof Date) {
        // It's already a Date object
        dueDateValue = formData.dueDate.toISOString().slice(0, 16);
      } else if (typeof formData.dueDate === 'string') {
        // It's a string, try to parse it
        dueDateValue = new Date(formData.dueDate).toISOString().slice(0, 16);
      }
      document.getElementById('dueDate').value = dueDateValue;
    }
    
    // Set form type
    currentFormType = formData.type;
    document.querySelector(`.form-type-btn[data-type="${currentFormType}"]`).classList.add('active');
    
    if (currentFormType === 'private') {
      document.getElementById('groupSelector').style.display = 'block';
      document.getElementById('group').value = formData.group;
    }

    // Load questions
    questions = formData.questions || [];
    questions.forEach(question => {
      addQuestion(question.type, question);
    });

  } catch (error) {
    console.error('Error loading form:', error);
    alert('Error loading form: ' + error.message);
  }
}

// Add the same helper functions as in create-form.js
function initializeFormTypeButtons() {
  const formTypeButtons = document.querySelectorAll('.form-type-btn');
  formTypeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      formTypeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      currentFormType = button.getAttribute('data-type');
      const groupSelector = document.getElementById('groupSelector');
      if (groupSelector) {
        groupSelector.style.display = currentFormType === 'private' ? 'block' : 'none';
      }
    });
  });
}

function initializeQuestionTypeButtons() {
  const questionTypeButtons = document.querySelectorAll('.question-type-btn');
  questionTypeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const type = button.getAttribute('data-type');
      if (type) {
        addQuestion(type);
      }
    });
  });
}

function initializeCancelButton() {
  const cancelButton = document.getElementById('cancelForm');
  if (cancelButton) {
    cancelButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
        window.location.href = 'forms.html';
      }
    });
  }
}

function initializeFormSubmission() {
  const form = document.getElementById('editFormForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
}

function updateQuestions() {
  questions = [];
  document.querySelectorAll('.question-container').forEach(container => {
    const question = {
      type: container.querySelector('.question-title-input').closest('.question-container').dataset.type,
      question: container.querySelector('.question-title-input').value,
      required: container.querySelector('.required-toggle input').checked,
      options: [],
      scale: null
    };

    // Get options for multiple choice and checkboxes
    if (question.type === 'Multiple Choice' || question.type === 'Checkboxes') {
      const optionInputs = container.querySelectorAll('.option-input');
      question.options = Array.from(optionInputs).map(input => input.value).filter(val => val.trim());
    }

    // Get scale settings for linear scale
    if (question.type === 'Linear Scale') {
      const scaleMin = container.querySelector('.scale-min');
      const scaleMax = container.querySelector('.scale-max');
      const scaleMinLabel = container.querySelector('.scale-min-label');
      const scaleMaxLabel = container.querySelector('.scale-max-label');
      
      if (scaleMin && scaleMax && scaleMinLabel && scaleMaxLabel) {
        question.scale = {
          min: parseInt(scaleMin.value),
          max: parseInt(scaleMax.value),
          minLabel: scaleMinLabel.value,
          maxLabel: scaleMaxLabel.value
        };
      }
    }

    questions.push(question);
  });
}

// Modify the form submission handler for updating instead of creating
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!auth.currentUser) {
    showAuthAlert();
    return;
  }

  // Show loading state
  const submitBtn = e.target.querySelector('.submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Updating...';
  submitBtn.disabled = true;

  try {
    updateQuestions();

    const formData = {
      title: document.getElementById('formTitle').value,
      description: document.getElementById('formDescription').value,
      dueDate: Timestamp.fromDate(new Date(document.getElementById('dueDate').value)),
      type: currentFormType,
      group: currentFormType === 'private' ? document.getElementById('group').value : null,
      questions: questions,
      lastModified: Timestamp.now()
    };

    const formRef = doc(db, 'forms', formId);
    await updateDoc(formRef, formData);
    
    // Show success message
    alert('Form updated successfully!');
    window.location.href = 'forms.html';
    
  } catch (error) {
    console.error('Error updating form:', error);
    alert('Error updating form: ' + error.message);
    
    // Reset button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function addQuestion(type, existingQuestion = null) {
  const questionDiv = document.createElement('div');
  questionDiv.className = 'question-container';
  questionDiv.dataset.type = type;
  
  const questionData = existingQuestion || {
    type: type,
    question: '',
    required: false,
    options: type === 'Multiple Choice' || type === 'Checkboxes' ? ['Option 1'] : [],
    scale: type === 'Linear Scale' ? { min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' } : null
  };

  questionDiv.innerHTML = `
    <div class="question-header">
      <input type="text" class="question-title-input" placeholder="Question" 
        value="${(questionData.question || '').replace(/"/g, '&quot;')}" required>
      <div class="question-controls">
        <label class="required-toggle">
          <input type="checkbox" ${questionData.required ? 'checked' : ''}>
          Required
        </label>
        <button type="button" class="delete-question-btn">Delete</button>
      </div>
    </div>
    ${generateQuestionInputs(type, questionData)}
  `;

  // Add event listeners for the question
  const deleteBtn = questionDiv.querySelector('.delete-question-btn');
  deleteBtn.addEventListener('click', () => {
    questionDiv.remove();
    updateQuestions();
  });

  const requiredToggle = questionDiv.querySelector('.required-toggle input');
  requiredToggle.addEventListener('change', updateQuestions);

  // Add options management for multiple choice and checkboxes
  if (type === 'Multiple Choice' || type === 'Checkboxes') {
    setupOptionManagement(questionDiv);
  }

  document.getElementById('questionsContainer').appendChild(questionDiv);
  updateQuestions();
}

function generateQuestionInputs(type, data) {
  switch (type) {
    case 'Multiple Choice':
    case 'Checkboxes':
      return `
        <div class="options-container">
          ${(data.options || ['Option 1']).map(option => `
            <div class="option-row">
              <input type="text" class="option-input" value="${option.replace(/"/g, '&quot;')}">
              <button type="button" class="delete-option-btn">Delete</button>
            </div>
          `).join('')}
          <button type="button" class="add-option-btn">Add Option</button>
        </div>
      `;
    case 'Linear Scale':
      const scale = data.scale || { min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' };
      return `
        <div class="scale-settings">
          <div class="scale-inputs">
            <label>Min: <input type="number" class="scale-min" value="${scale.min}"></label>
            <label>Max: <input type="number" class="scale-max" value="${scale.max}"></label>
          </div>
          <div class="scale-labels">
            <label>Min Label: <input type="text" class="scale-min-label" value="${(scale.minLabel || '').replace(/"/g, '&quot;')}"></label>
            <label>Max Label: <input type="text" class="scale-max-label" value="${(scale.maxLabel || '').replace(/"/g, '&quot;')}"></label>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

function setupOptionManagement(questionDiv) {
  const optionsContainer = questionDiv.querySelector('.options-container');
  
  // Add new option
  optionsContainer.querySelector('.add-option-btn').addEventListener('click', () => {
    const optionRow = document.createElement('div');
    optionRow.className = 'option-row';
    optionRow.innerHTML = `
      <input type="text" class="option-input" value="New Option">
      <button type="button" class="delete-option-btn">Delete</button>
    `;
    optionsContainer.insertBefore(optionRow, optionsContainer.lastElementChild);
    updateQuestions();
  });

  // Delete option
  optionsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-option-btn')) {
      e.target.parentElement.remove();
      updateQuestions();
    }
  });
}