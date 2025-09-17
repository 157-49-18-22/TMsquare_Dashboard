import { 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserByEmail, createOrUpdateUser } from './firestoreApi';
import { serverTimestamp } from 'firebase/firestore';

// Admin credentials (for demo purposes - should use environment variables in production)
const ADMIN_EMAIL = 'fastag@gmail.com';
const ADMIN_PASSWORD = 'admin123456';

// Sample sub-admin emails (for demo purposes)
const SUB_ADMIN_EMAILS = ['mayank@gmail.com', 'rahul@gmail.com'];

export const loginWithEmailAndPassword = async (email, password) => {
  try {
    console.log('🔑 Attempting login with:', { email });
    
    // Check if credentials match admin credentials
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      console.log('👑 Admin login successful');
      
      // Create mock admin user object
      const adminUser = {
        uid: 'admin-user-id',
        email: ADMIN_EMAIL,
        displayName: 'Admin',
        isAdmin: true,
        isSuperAdmin: true
      };
      
      // Ensure admin user exists in Firestore
      await createOrUpdateUser(adminUser.uid, {
        email: ADMIN_EMAIL,
        displayName: 'Admin',
        isAdmin: true,
        isSuperAdmin: true,
        role: 'admin',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      
      return {
        success: true,
        user: adminUser
      };
    }
    
    // Check if credentials match sub-admin emails
    if (SUB_ADMIN_EMAILS.includes(email)) {
      try {
        // For sub-admins, still use Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Sub-admin Firebase authentication successful');
        
        // Get user data from Firestore
        const { success, user: userData, error } = await getUserByEmail(email);
        
        if (success) {
          console.log('📊 Sub-admin user data from Firestore:', userData);
          
          // Ensure user has a complete profile in Firestore with proper role
          await createOrUpdateUser(userCredential.user.uid, {
            email: userCredential.user.email,
            displayName: userData?.displayName || email.split('@')[0],
            isAdmin: true,
            isSuperAdmin: false,
            role: 'subAdmin',
            createdAt: userData?.createdAt || serverTimestamp(),
            lastLogin: serverTimestamp()
          });
          
          return {
            success: true,
            user: {
              ...userCredential.user,
              isAdmin: true
            }
          };
        } else {
          console.error('❌ Error fetching sub-admin user data:', error);
          await firebaseSignOut(auth);
          return {
            success: false,
            error: 'Error verifying sub-admin data'
          };
        }
      } catch (firebaseError) {
        console.error('❌ Sub-admin Firebase authentication failed:', firebaseError);
        return {
          success: false,
          error: 'Invalid sub-admin credentials'
        };
      }
    }
    
    // If not admin or sub-admin, deny access
    console.log('❌ Invalid credentials - not admin or sub-admin');
    return {
      success: false,
      error: 'Invalid email or password. Only admin and sub-admin access is allowed.'
    };
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const logout = async () => {
  try {
    console.log('🚪 Attempting logout');
    await firebaseSignOut(auth);
    console.log('✅ Logout successful');
    return { success: true };
  } catch (error) {
    console.error('❌ Logout error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const onAuthStateChange = (callback) => {
  console.log('👀 Setting up auth state listener');
  return onAuthStateChanged(auth, async (user) => {
    console.log('🔄 Auth state changed:', { 
      isAuthenticated: !!user,
      email: user?.email 
    });
    
    if (user) {
      // Get user data from Firestore
      const { success, user: userData } = await getUserByEmail(user.email);
      console.log('📊 User data from Firestore:', { success, userData });
      
      // Check user role - only sub-admins will come through Firebase Auth
      const isSubAdmin = SUB_ADMIN_EMAILS.includes(user.email) || userData?.role === 'subAdmin';
      const isAdmin = isSubAdmin;
      
      callback({
        currentUser: user,
        isAdmin,
        userData: {
          ...userData,
          isSuperAdmin: false,
          role: isSubAdmin ? 'subAdmin' : 'user'
        }
      });
    } else {
      callback({
        currentUser: null,
        isAdmin: false,
        userData: null
      });
    }
  });
}; 