import { db } from '/config/firebase-config.js';
import { 
  collection, 
  addDoc, 
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export const AnnouncementService = {
  async create(announcement) {
    return await addDoc(collection(db, "announcements"), announcement);
  },
  
  async getAll(pageSize = 10, startAfterDoc = null) {
    let q = query(
      collection(db, "announcements"),
      orderBy("time", "desc"),
      limit(pageSize)
    );
    
    if (startAfterDoc) {
      q = query(q, startAfter(startAfterDoc));
    }
    
    return await getDocs(q);
  },
  
  async delete(id) {
    return await deleteDoc(doc(db, "announcements", id));
  }
};