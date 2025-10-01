import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBez_mPjbkTD583Ykd-umcvhnkjTUQ03Tw",
  authDomain: "tmsquareapp-df8f8.firebaseapp.com",
  projectId: "tmsquareapp-df8f8",
  storageBucket: "tmsquareapp-df8f8.firebasestorage.app",
  messagingSenderId: "540362960766",
  appId: "1:540362960766:web:e543f09786c61b067e4d2f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { auth, db };
export default app; 