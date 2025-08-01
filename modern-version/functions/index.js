const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure your email service (Gmail example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nepp.advisors@gmail.com', // Replace with your actual Gmail
    pass: 'Ymnjx roko okmg oxse'     // Replace with your Gmail App Password
  }
});

// Cloud Function to send email when feedback is submitted
exports.sendFeedbackEmail = functions.firestore
  .document('feedback/{feedbackId}')
  .onCreate(async (snap, context) => {
    console.log('🚀 Cloud Function triggered for feedback:', context.params.feedbackId);
    
    const feedbackData = snap.data();
    console.log('📧 Feedback data:', feedbackData);
    
    // Only send email if not already sent
    if (feedbackData.emailNotificationSent) {
      console.log('✅ Email already sent for this feedback, skipping');
      return null;
    }

    const mailOptions = {
      from: 'nepp.advisors@gmail.com', // Same as the authenticated account
      to: 'nepp.advisors@gmail.com',
      subject: `NEPP Feedback: ${feedbackData.type.toUpperCase()} - ${feedbackData.subject}`,
      html: `
        <h3>New NEPP Feedback Received</h3>
        <p><strong>Type:</strong> ${feedbackData.type}</p>
        <p><strong>Subject:</strong> ${feedbackData.subject}</p>
        <p><strong>From:</strong> ${feedbackData.userEmail}</p>
        <p><strong>User ID:</strong> ${feedbackData.userId}</p>
        <p><strong>Submitted:</strong> ${feedbackData.createdAt?.toDate()}</p>
        
        <h4>Message:</h4>
        <p>${feedbackData.message}</p>
        
        ${feedbackData.userInfo ? `
        <h4>User Information:</h4>
        <ul>
          ${feedbackData.userInfo.displayName ? `<li><strong>Name:</strong> ${feedbackData.userInfo.displayName}</li>` : ''}
          ${feedbackData.userInfo.username ? `<li><strong>Username:</strong> ${feedbackData.userInfo.username}</li>` : ''}
          ${feedbackData.userInfo.role ? `<li><strong>Role:</strong> ${feedbackData.userInfo.role}</li>` : ''}
          ${feedbackData.userInfo.department ? `<li><strong>Department:</strong> ${feedbackData.userInfo.department}</li>` : ''}
        </ul>
        ` : ''}
        
        <hr>
        <p><em>This is an automated message from the NEPP feedback system.</em></p>
      `
    };

    try {
      console.log('📤 Attempting to send email...');
      console.log('📧 Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      
      await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully!');
      
      // Mark email as sent in the database
      await snap.ref.update({
        emailNotificationSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Database updated with email status');
      
    } catch (error) {
      console.error('❌ Error sending feedback email:', error);
      console.error('❌ Error details:', error.message);
      
      // Still mark as attempted to avoid infinite retries
      await snap.ref.update({
        emailNotificationSent: false,
        emailError: error.message,
        emailAttemptedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
