import { db } from '/config/firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export const FormsService = {
  async create(form) {
    return await addDoc(collection(db, "forms"), {
      ...form,
      targetUsers: form.targetUsers || [], // Array of user IDs
      isPublic: form.isPublic || false,
      createdAt: serverTimestamp(),
    });
  },

  async getAll(userId) {
    try {
      if (!userId) {
        console.error('No userId provided to getAll()');
        return [];
      }

      const q = query(collection(db, "forms"), 
        where("isPublic", "==", true));
      
      const [publicForms, targetedForms] = await Promise.all([
        getDocs(q),
        getDocs(query(collection(db, "forms"),
          where("targetUsers", "array-contains", userId)))
      ]);

      const forms = [];
      publicForms.forEach(doc => forms.push({ id: doc.id, ...doc.data() }));
      targetedForms.forEach(doc => {
        if (!forms.some(f => f.id === doc.id)) {
          forms.push({ id: doc.id, ...doc.data() });
        }
      });

      return forms.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    } catch (error) {
      console.error('Error fetching forms:', error);
      return [];
    }
  }
};