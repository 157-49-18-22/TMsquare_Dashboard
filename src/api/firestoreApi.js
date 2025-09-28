import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  limit,
  startAfter
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  updatePassword, 
  updateEmail, 
  getAuth, 
  signInWithEmailAndPassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { auth } from '../firebase/config';

// User Management Functions
export const createOrUpdateUser = async (userId, userData) => {
  try {
    console.log('📝 Creating/Updating user:', { userId, ...userData });
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('✅ User document created/updated successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error creating/updating user:', error);
    return { success: false, error: error.message };
  }
};

export const getUserData = async (userId) => {
  try {
    console.log('🔍 Fetching user data for:', userId);
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log('✅ User data found');
      return { 
        success: true, 
        user: { id: userSnap.id, ...userSnap.data() } 
      };
    } else {
      console.log('❌ User document does not exist');
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    return { success: false, error: error.message };
  }
};

export const getAllUsers = async (filters = {}) => {
  try {
    console.log('🔍 Fetching all users with filters:', filters);
    const usersRef = collection(db, 'users');
    let q = usersRef;

    // Apply filters if provided
    if (filters.email) {
      q = query(usersRef, where('email', '==', filters.email));
    }

    const querySnapshot = await getDocs(q);
    console.log(`📊 Found ${querySnapshot.size} users`);

    const users = [];
    querySnapshot.forEach((doc) => {
      console.log('📄 User document:', { id: doc.id, ...doc.data() });
      users.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, users };
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return { success: false, error: error.message };
  }
};

export const updateUserData = async (userId, userData, walletPasswordObj = null, walletAccessPassword = null) => {
  try {
    console.log('📝 Updating user:', { userId, ...userData });
    const userRef = doc(db, 'users', userId);
    
    // Get current user data to compare changes
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.error('❌ User document not found');
      return { success: false, error: 'User not found' };
    }
    
    const currentUserData = userSnap.data();
    const updatedData = { ...userData, updatedAt: serverTimestamp() };
    
    // Remove sensitive fields from Firestore update
    const { password, ...firestoreData } = updatedData;
    
    // Track operations
    const operations = [];
    
    // Handle password update if provided
    if (password && password.trim() !== '') {
      try {
        console.log('🔑 Password update requested for user:', userId);
        // In a real admin scenario, this would be handled by Firebase Admin SDK
        // on a secure server. For this frontend implementation, we'll just
        // update the Firestore document and note the limitation.
        operations.push({
          type: 'password',
          success: false,
          message: 'Password updates for other users require Firebase Admin SDK on a backend server'
        });
      } catch (passwordError) {
        console.error('❌ Error with password update:', passwordError);
        operations.push({
          type: 'password',
          success: false,
          error: passwordError.message
        });
      }
    }
    
    // Handle identity document updates
    if (firestoreData.aadharCard !== currentUserData.aadharCard) {
      console.log('📋 Aadhar card update detected');
      operations.push({
        type: 'aadharCard',
        success: true,
        message: 'Aadhar card information updated'
      });
    }
    
    if (firestoreData.panCard !== currentUserData.panCard) {
      console.log('📋 PAN card update detected');
      operations.push({
        type: 'panCard',
        success: true,
        message: 'PAN card information updated'
      });
    }
    
    // Handle wallet balance update
    if (firestoreData.wallet !== undefined && firestoreData.wallet !== currentUserData.wallet) {
      console.log('💰 Wallet balance update detected', { 
        old: currentUserData.wallet || 0, 
        new: firestoreData.wallet 
      });
      
      // Log the wallet update
      await logWalletUpdate(
        userId, 
        currentUserData.wallet || 0, 
        firestoreData.wallet,
        null, // No password ID needed
        walletAccessPassword || 'admin_update' // Use wallet access password if provided, otherwise mark as admin update
      );
      
      operations.push({
        type: 'wallet',
        success: true,
        message: 'Wallet balance updated successfully'
      });
    }
    
    // Update Firestore document
    await updateDoc(userRef, firestoreData);
    console.log('✅ User data updated in Firestore');
    operations.push({
      type: 'firestoreData',
      success: true,
      message: 'User profile data updated successfully'
    });
    
    // Prepare response
    const hasWarnings = operations.some(op => !op.success);
    
    return { 
      success: true, 
      operations,
      warnings: hasWarnings ? operations.filter(op => !op.success).map(op => op.message || op.error) : null
    };
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return { success: false, error: error.message };
  }
};

export const deleteUserData = async (userId) => {
  try {
    console.log('🗑️ Deleting user:', userId);
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    console.log('✅ User deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return { success: false, error: error.message };
  }
};

export const getUserByEmail = async (email) => {
  try {
    console.log('🔍 Fetching user by email:', email);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      console.log('✅ User found:', { id: userDoc.id, ...userDoc.data() });
      return { 
        success: true, 
        user: { id: userDoc.id, ...userDoc.data() } 
      };
    } else {
      console.log('❌ No user found with email:', email);
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('❌ Error fetching user by email:', error);
    return { success: false, error: error.message };
  }
};

// Sub-admin management functions
export const assignUserToSubAdmin = async (userId, subAdminId) => {
  try {
    console.log('📝 Assigning user to sub-admin:', { userId, subAdminId });
    const userRef = doc(db, 'users', userId);
    
    // Update user document with assigned sub-admin
    await updateDoc(userRef, {
      assignedTo: subAdminId,
      updatedAt: serverTimestamp()
    });
    
    // Log this assignment action
    const assignmentLogRef = collection(db, 'assignmentLogs');
    await addDoc(assignmentLogRef, {
      userId,
      subAdminId,
      assignedBy: auth.currentUser.uid,
      assignedAt: serverTimestamp()
    });
    
    console.log('✅ User assigned to sub-admin successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error assigning user to sub-admin:', error);
    return { success: false, error: error.message };
  }
};

export const unassignUserFromSubAdmin = async (userId) => {
  try {
    console.log('🔄 Unassigning user from sub-admin:', userId);
    const userRef = doc(db, 'users', userId);
    
    // Remove sub-admin assignment
    await updateDoc(userRef, {
      assignedTo: null,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ User unassigned successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error unassigning user:', error);
    return { success: false, error: error.message };
  }
};

export const getSubAdmins = async () => {
  try {
    console.log('🔍 Fetching all sub-admins');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'subAdmin'));
    const querySnapshot = await getDocs(q);
    
    const subAdmins = [];
    querySnapshot.forEach((doc) => {
      subAdmins.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Found ${subAdmins.length} sub-admins`);
    return { success: true, subAdmins };
  } catch (error) {
    console.error('❌ Error fetching sub-admins:', error);
    return { success: false, error: error.message };
  }
};

export const getUsersBySubAdmin = async (subAdminId) => {
  try {
    console.log('🔍 Fetching users assigned to sub-admin:', subAdminId);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('assignedTo', '==', subAdminId));
    const querySnapshot = await getDocs(q);
    
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Found ${users.length} users assigned to sub-admin`);
    return { success: true, users };
  } catch (error) {
    console.error('❌ Error fetching users by sub-admin:', error);
    return { success: false, error: error.message };
  }
};

// Alias for updateUserData to maintain compatibility
export const updateUser = updateUserData;

// Wallet Password Management Functions
export const generateWalletPassword = async () => {
  try {
    // Generate a random 6-digit password
    const password = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the password in the walletUpdatePasswords collection
    const passwordDoc = await addDoc(collection(db, 'walletUpdatePasswords'), {
      password,
      createdAt: serverTimestamp(),
      isUsed: false,
      createdBy: auth.currentUser?.uid || 'system'
    });
    
    console.log('✅ Wallet update password generated successfully');
    return { 
      success: true, 
      passwordId: passwordDoc.id,
      password 
    };
  } catch (error) {
    console.error('❌ Error generating wallet password:', error);
    return { success: false, error: error.message };
  }
};

export const verifyWalletPassword = async (password) => {
  try {
    // Query for the password in the walletUpdatePasswords collection
    const passwordsRef = collection(db, 'walletUpdatePasswords');
    const q = query(passwordsRef, where('password', '==', password), where('isUsed', '==', false));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, error: 'Invalid or expired password' };
    }
    
    // Get the first matching password document
    const passwordDoc = querySnapshot.docs[0];
    const passwordId = passwordDoc.id;
    
    return { success: true, passwordId };
  } catch (error) {
    console.error('❌ Error verifying wallet password:', error);
    return { success: false, error: error.message };
  }
};

export const logWalletUpdate = async (userId, oldValue, newValue, passwordId, actualPassword = null) => {
  try {
    // Log the wallet update
    await addDoc(collection(db, 'walletUpdateLogs'), {
      userId,
      oldValue,
      newValue,
      updatedBy: auth.currentUser?.uid || 'system',
      updatedAt: serverTimestamp(),
      passwordId,
      actualPassword: actualPassword || 'system_update' // Store the actual password entered
    });
    
    // Mark the password as used
    if (passwordId) {
      const passwordRef = doc(db, 'walletUpdatePasswords', passwordId);
      await updateDoc(passwordRef, {
        isUsed: true,
        usedAt: serverTimestamp(),
        usedBy: auth.currentUser?.uid || 'system',
        usedForUser: userId
      });
    }
    
    console.log('✅ Wallet update logged successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error logging wallet update:', error);
    return { success: false, error: error.message };
  }
};

// Create a new wallet access password
export const createWalletAccessPassword = async (password, expiresAt = null, name = '') => {
  try {
    console.log('🔑 Creating wallet access password');
    const passwordsRef = collection(db, 'walletAccessPasswords');
    
    const passwordData = {
      password,
      name,
      isActive: true,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt ? new Date(expiresAt) : null
    };
    
    const docRef = await addDoc(passwordsRef, passwordData);
    console.log('✅ Wallet access password created successfully');
    return { success: true, passwordId: docRef.id };
  } catch (error) {
    console.error('❌ Error creating wallet access password:', error);
    return { success: false, error: error.message };
  }
};

// Get all wallet access passwords
export const getWalletAccessPasswords = async () => {
  try {
    const passwordsRef = collection(db, 'walletAccessPasswords');
    const querySnapshot = await getDocs(passwordsRef);
    
    const passwords = [];
    querySnapshot.forEach(doc => {
      passwords.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, passwords };
  } catch (error) {
    console.error('❌ Error fetching wallet access passwords:', error);
    return { success: false, error: error.message };
  }
};

// Deactivate a wallet access password
export const deactivateWalletAccessPassword = async (passwordId) => {
  try {
    const passwordRef = doc(db, 'walletAccessPasswords', passwordId);
    await updateDoc(passwordRef, {
      isActive: false,
      deactivatedAt: serverTimestamp(),
      deactivatedBy: auth.currentUser?.uid || 'system'
    });
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error deactivating wallet access password:', error);
    return { success: false, error: error.message };
  }
};

// Verify wallet access password
export const verifyWalletAccessPassword = async (password) => {
  try {
    // Query for active passwords
    const passwordsRef = collection(db, 'walletAccessPasswords');
    const q = query(
      passwordsRef, 
      where('password', '==', password),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, error: 'Invalid or expired password' };
    }
    
    // Check for expired passwords
    const now = new Date();
    let validPassword = null;
    
    for (const doc of querySnapshot.docs) {
      const passwordData = doc.data();
      
      // Check if password is expired
      if (passwordData.expiresAt && now > new Date(passwordData.expiresAt.toDate())) {
        continue; // Skip expired passwords
      }
      
      validPassword = {
        id: doc.id,
        ...passwordData
      };
      break;
    }
    
    if (!validPassword) {
      return { success: false, error: 'Password has expired' };
    }
    
    // Log access attempt
    await addDoc(collection(db, 'walletAccessLogs'), {
      passwordId: validPassword.id,
      accessedBy: auth.currentUser?.uid || 'unknown',
      accessedAt: serverTimestamp(),
      success: true
    });
    
    return { success: true, passwordId: validPassword.id };
  } catch (error) {
    console.error('❌ Error verifying wallet access password:', error);
    return { success: false, error: error.message };
  }
}; 

/**
 * Logs successful registration to a separate collection for admin dashboard efficiency
 * This collection only stores successful registrations to reduce Firebase reads
 * @param {Object} formData - The form data from successful registration
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {Object} userData - User data (bcId, displayName, minFasTagBalance)
 * @returns {Promise<Object>} Object containing success status and document ID
 */
export const logSuccessfulRegistration = async (formData, userId, userEmail, userData = {}) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Extract relevant data for admin dashboard
    const vehicleNo = formData.vehicleNo || 
                     formData.finalRegistrationData?.vrnDetails?.vrn ||
                     formData.vrn ||
                     'N/A';
                     
    const serialNo = formData.serialNo || 
                     formData.finalRegistrationData?.fasTagDetails?.serialNo ||
                     'N/A';
                     
    const mobileNo = formData.mobileNo || 
                     formData.finalRegistrationData?.custDetails?.mobileNo ||
                     'N/A';
    
    const registrationData = {
      vehicleNo,
      serialNo,
      mobileNo,
      userId,
      userEmail,
      bcId: userData.bcId || 'N/A',
      displayName: userData.displayName || 'Unknown',
      minFasTagBalance: userData.minFasTagBalance || '400',
      timestamp,
      createdAt: timestamp,
      // Store original form data for reference
      originalFormData: formData
    };
    
    console.log('Saving successful registration:', registrationData);
    const docRef = await addDoc(collection(db, 'successfulRegistrations'), registrationData);
    
    console.log('Successful registration saved with ID:', docRef.id);
    
    return { 
      success: true, 
      registrationId: docRef.id
    };
  } catch (error) {
    console.error('Error logging successful registration:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Transfers successful registrations from formLogs to successfulRegistrations collection
 * This function fetches data from the large formLogs database and transfers only successful registrations
 * to the optimized successfulRegistrations collection for better admin dashboard performance
 * @returns {Promise<Object>} Object containing transfer results
 */
export const transferSuccessfulRegistrationsFromFormLogs = async () => {
  try {
    console.log('🔄 Starting transfer of successful registrations from formLogs...');
    
    // Query formLogs where action is "register"
    const formLogsRef = collection(db, 'formLogs');
    const q = query(
      formLogsRef,
      where('action', '==', 'register'),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    console.log(`📊 Found ${snapshot.size} form logs with action=register`);
    
    let transferredCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Check for existing registrations to avoid duplicates
    const existingRegistrationsRef = collection(db, 'successfulRegistrations');
    const existingSnapshot = await getDocs(existingRegistrationsRef);
    const existingIds = new Set();
    
    existingSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Create a unique key based on vehicle number and timestamp
      const key = `${data.vehicleNo}_${data.timestamp}`;
      existingIds.add(key);
    });
    
    console.log(`📋 Found ${existingIds.size} existing registrations to avoid duplicates`);
    
    // Process each form log
    for (const docSnapshot of snapshot.docs) {
      const logData = docSnapshot.data();
      
      try {
        // Check if this is a successful registration
        if (logData.formData?.apiSuccess === true || 
            (logData.formData?.registrationResponse?.response?.status === "success") ||
            (logData.status === "success" && logData.action === "register")) {
          
          // Extract fields from correct paths in the document structure
          let vehicleNo = logData.formData?.vehicleNo || 
                         logData.formData?.finalRegistrationData?.vrnDetails?.vrn ||
                         logData.formData?.vrn ||
                         'N/A';
                         
          let serialNo = logData.formData?.serialNo || 
                         logData.formData?.finalRegistrationData?.fasTagDetails?.serialNo ||
                         'N/A';
                         
          let mobileNo = logData.formData?.mobileNo || 
                         logData.formData?.finalRegistrationData?.custDetails?.mobileNo ||
                         'N/A';
          
          // Ensure timestamp is properly extracted and processed
          let timestamp = logData.timestamp;
          if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
            timestamp = timestamp.toDate().toISOString();
          } else if (typeof timestamp === 'string') {
            timestamp = timestamp;
          } else if (!timestamp) {
            timestamp = logData.createdAt || new Date().toISOString();
          }
          
          // Create unique key to check for duplicates
          const uniqueKey = `${vehicleNo}_${timestamp}`;
          
          if (existingIds.has(uniqueKey)) {
            console.log(`⏭️ Skipping duplicate registration: ${vehicleNo}`);
            skippedCount++;
            continue;
          }
          
          // Fetch user data
          let userData = {
            bcId: 'N/A',
            displayName: 'Unknown',
            minFasTagBalance: '400'
          };
          
          if (logData.userId) {
            try {
              const userRef = doc(db, 'users', logData.userId);
              const userDoc = await getDoc(userRef);
              
              if (userDoc.exists()) {
                const userDocData = userDoc.data();
                userData = {
                  bcId: userDocData.bcId || 'N/A',
                  displayName: userDocData.displayName || 'Unknown',
                  minFasTagBalance: userDocData.minFasTagBalance || '400'
                };
              }
            } catch (userError) {
              console.error(`Error fetching user data for ${logData.userId}:`, userError);
            }
          }
          
          // Transfer to successfulRegistrations collection
          const result = await logSuccessfulRegistration(
            logData.formData,
            logData.userId || '',
            logData.userEmail || 'N/A',
            userData
          );
          
          if (result.success) {
            transferredCount++;
            console.log(`✅ Transferred registration: ${vehicleNo}`);
          } else {
            errorCount++;
            errors.push({
              vehicleNo,
              error: result.error
            });
            console.error(`❌ Error transferring registration: ${vehicleNo}`, result.error);
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        errors.push({
          docId: docSnapshot.id,
          error: error.message
        });
        console.error(`❌ Error processing form log ${docSnapshot.id}:`, error);
      }
    }
    
    console.log(`✅ Transfer completed: ${transferredCount} transferred, ${skippedCount} skipped, ${errorCount} errors`);
    
    return {
      success: true,
      transferredCount,
      skippedCount,
      errorCount,
      errors: errors.length > 0 ? errors : null
    };
    
  } catch (error) {
    console.error('❌ Error transferring successful registrations:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}; 

/**
 * Fetches successful registrations with pagination to reduce read load
 * Initially loads only 30 days of data, with option to load more
 * @param {Object} options - Pagination options
 * @param {Date} options.startDate - Start date for the query (defaults to 30 days ago)
 * @param {Date} options.endDate - End date for the query (defaults to now)
 * @param {number} options.limit - Maximum number of documents to fetch (defaults to 1000)
 * @param {string} options.lastDocId - ID of the last document for pagination
 * @returns {Promise<Object>} Object containing registrations and pagination info
 */
export const getSuccessfulRegistrationsPaginated = async (options = {}) => {
  try {
    console.log('🔍 Fetching successful registrations with pagination:', options);
    
          const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate = new Date(),
        limitCount = 1000,
        lastDocId = null
      } = options;
    
    const registrationsRef = collection(db, 'successfulRegistrations');
    
    // Create base query with date range and ordering
    let q = query(
      registrationsRef,
      where('timestamp', '>=', startDate.toISOString()),
      where('timestamp', '<=', endDate.toISOString()),
      orderBy('timestamp', 'desc'),
      orderBy('__name__', 'desc') // Secondary sort for consistent pagination
    );
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    // Apply pagination cursor if provided
    if (lastDocId) {
      const lastDocRef = doc(db, 'successfulRegistrations', lastDocId);
      const lastDocSnap = await getDoc(lastDocRef);
      
      if (lastDocSnap.exists()) {
        q = query(q, startAfter(lastDocSnap));
      }
    }
    
    const snapshot = await getDocs(q);
    console.log(`📊 Found ${snapshot.size} registrations for the date range`);
    
    const registrationsList = [];
    let lastVisibleDoc = null;
    
    for (const docSnapshot of snapshot.docs) {
      const registrationData = docSnapshot.data();
      console.log(`Processing registration ${docSnapshot.id}, timestamp:`, registrationData.timestamp);
      console.log(`OriginalFormData:`, registrationData.originalFormData);
      console.log(`OriginalFormData timestamp:`, registrationData.originalFormData?.timestamp);
      
      // Use originalFormData.timestamp as primary timestamp
      let timestamp = registrationData.originalFormData?.timestamp || registrationData.timestamp;
      if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
        timestamp = timestamp.toDate();
      } else if (typeof timestamp === 'string') {
        timestamp = timestamp;
      } else if (!timestamp) {
        timestamp = registrationData.createdAt || new Date().toISOString();
      }
      
      const processedRegistration = {
        id: docSnapshot.id,
        vehicleNo: registrationData.vehicleNo || 'N/A',
        timestamp: timestamp,
        serialNo: registrationData.serialNo || 'N/A',
        mobileNo: registrationData.mobileNo || 'N/A',
        userId: registrationData.userId || '',
        userEmail: registrationData.userEmail || 'N/A',
        bcId: registrationData.bcId || 'N/A',
        displayName: registrationData.displayName || 'Unknown',
        minFasTagBalance: registrationData.minFasTagBalance || '400',
        secondtimestamp: registrationData.timestamp || registrationData.originalFormData?.reqDateTime || 'N/A'
      };
      
      registrationsList.push(processedRegistration);
      lastVisibleDoc = docSnapshot;
    }
    console.log("Registrations list:", registrationsList);
    if (registrationsList.length > 0) {
      console.log("First registration secondtimestamp:", registrationsList[0].secondtimestamp);
    }
    console.log(`✅ [getSuccessfulRegistrationsPaginated] ${registrationsList.length} registrations fetched`);
    
    return {
      success: true,
      registrations: registrationsList,
      hasMore: snapshot.size === limitCount,
      lastDocId: lastVisibleDoc ? lastVisibleDoc.id : null,
      totalFetched: registrationsList.length,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };
    
  } catch (error) {
    console.error('❌ Error fetching successful registrations with pagination:', error);
    return { success: false, error: error.message };
  }
}; 