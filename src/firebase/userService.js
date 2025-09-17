import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from './config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { createActivity } from './models';

// Get all users
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Get users assigned to a specific sub-admin
export const getAssignedUsers = async (subAdminId) => {
  try {
    // Check if this is a super admin or sub-admin first
    const adminRef = doc(db, 'users', subAdminId);
    const adminDoc = await getDoc(adminRef);
    
    if (!adminDoc.exists()) {
      console.error('Admin document not found');
      return [];
    }
    
    const adminData = adminDoc.data();
    
    // If this is a super admin, they don't have directly assigned users
    // Return an empty array to prevent Firestore query errors
    if (adminData.isSuperAdmin === true) {
      console.log('Super admin detected in getAssignedUsers, returning empty array');
      return [];
    }
    
    // Get users assigned to this sub-admin
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef, 
      where('assignedTo', '==', subAdminId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching assigned users:', error);
    throw error;
  }
};

// Get all sub-admins
export const getAllSubAdmins = async () => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef, 
      where('role', '==', 'subAdmin'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching sub-admins:', error);
    throw error;
  }
};

// Get a specific sub-admin
export const getSubAdmin = async (subAdminId) => {
  try {
    const userRef = doc(db, 'users', subAdminId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists() && userDoc.data().role === 'subAdmin') {
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
    
    throw new Error('Sub-admin not found');
  } catch (error) {
    console.error('Error fetching sub-admin:', error);
    throw error;
  }
};

// Assign a user to a sub-admin
export const assignUserToSubAdmin = async (userId, subAdminId, adminId) => {
  try {
    // Verify the sub-admin exists
    const subAdminRef = doc(db, 'users', subAdminId);
    const subAdminDoc = await getDoc(subAdminRef);
    
    if (!subAdminDoc.exists() || subAdminDoc.data().role !== 'subAdmin') {
      throw new Error('Invalid sub-admin ID');
    }
    
    // Update user's assignedTo field
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists() || userDoc.data().role !== 'user') {
      throw new Error('Invalid user ID');
    }
    
    // Update the user document
    await updateDoc(userRef, { 
      assignedTo: subAdminId,
      updatedAt: serverTimestamp()
    });
    
    // Add this user to the sub-admin's assignedUsers array if not already there
    const subAdminData = subAdminDoc.data();
    const assignedUsers = subAdminData.assignedUsers || [];
    
    if (!assignedUsers.includes(userId)) {
      await updateDoc(subAdminRef, {
        assignedUsers: [...assignedUsers, userId],
        updatedAt: serverTimestamp()
      });
    }
    
    // Add activity to user's history
    const userData = userDoc.data();
    const activity = createActivity(
      userId, 
      'assignment', 
      `Assigned to ${subAdminData.displayName}`, 
      adminId
    );
    
    const activityHistory = userData.activityHistory || [];
    await updateDoc(userRef, {
      activityHistory: [activity, ...activityHistory]
    });
    
    return true;
  } catch (error) {
    console.error('Error assigning user to sub-admin:', error);
    throw error;
  }
};

// Unassign a user from a sub-admin
export const unassignUser = async (userId, adminId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const currentSubAdminId = userData.assignedTo;
    
    if (currentSubAdminId) {
      // Remove assignment from user
      await updateDoc(userRef, { 
        assignedTo: null,
        updatedAt: serverTimestamp()
      });
      
      // Remove user from sub-admin's assignedUsers array
      const subAdminRef = doc(db, 'users', currentSubAdminId);
      const subAdminDoc = await getDoc(subAdminRef);
      
      if (subAdminDoc.exists()) {
        const subAdminData = subAdminDoc.data();
        const assignedUsers = subAdminData.assignedUsers || [];
        
        await updateDoc(subAdminRef, {
          assignedUsers: assignedUsers.filter(id => id !== userId),
          updatedAt: serverTimestamp()
        });
      }
      
      // Add activity to user's history
      const activity = createActivity(
        userId, 
        'unassignment', 
        'Removed from sub-admin assignment', 
        adminId
      );
      
      const activityHistory = userData.activityHistory || [];
      await updateDoc(userRef, {
        activityHistory: [activity, ...activityHistory]
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error unassigning user:', error);
    throw error;
  }
};

// Create a new sub-admin
export const createSubAdmin = async (subAdminData, adminId) => {
  try {
    const { id, email, displayName } = subAdminData;
    
    const userRef = doc(db, 'users', id);
    await setDoc(userRef, {
      email,
      displayName,
      role: 'subAdmin',
      isAdmin: true,
      isSuperAdmin: false,
      assignedUsers: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error creating sub-admin:', error);
    throw error;
  }
};

// Check if user has access to another user's data
export const canAccessUser = async (accessorId, targetUserId) => {
  try {
    // Get the accessor's data
    const accessorRef = doc(db, 'users', accessorId);
    const accessorDoc = await getDoc(accessorRef);
    
    if (!accessorDoc.exists()) {
      return false;
    }
    
    const accessorData = accessorDoc.data();
    
    // Super-admin can access any user
    if (accessorData.isSuperAdmin) {
      return true;
    }
    
    // Sub-admin can only access assigned users
    if (accessorData.role === 'subAdmin') {
      const assignedUsers = accessorData.assignedUsers || [];
      return assignedUsers.includes(targetUserId);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking access rights:', error);
    return false;
  }
};

// Add a user activity
export const addUserActivity = async (userId, type, description, performedBy) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const activity = createActivity(userId, type, description, performedBy);
    const activityHistory = userData.activityHistory || [];
    
    await updateDoc(userRef, {
      activityHistory: [activity, ...activityHistory]
    });
    
    return true;
  } catch (error) {
    console.error('Error adding user activity:', error);
    throw error;
  }
};

// Update user status
export const updateUserStatus = async (userId, status) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { 
      status,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Update user role
export const updateUserRole = async (userId, role) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { 
      role,
      isAdmin: role === 'admin' || role === 'subAdmin',
      isSuperAdmin: role === 'admin',
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

// Delete user
export const deleteUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Get user statistics
export const getUserStats = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const users = querySnapshot.docs.map(doc => doc.data());
    
    return {
      totalUsers: users.filter(user => user.role === 'user').length,
      activeUsers: users.filter(user => user.status === 'active' && user.role === 'user').length,
      adminUsers: users.filter(user => user.isAdmin === true).length,
      subAdmins: users.filter(user => user.role === 'subAdmin').length,
      newUsers: users.filter(user => {
        const createdAt = user.createdAt?.toDate();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return createdAt && createdAt > oneWeekAgo && user.role === 'user';
      }).length
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Update user (all fields)
export const updateUser = async (userId, userData) => {
  try {
    console.log('📝 Updating user details:', { userId, ...userData });
    const userRef = doc(db, 'users', userId);
    
    // Validate government ID formats if provided
    const validationErrors = [];
    
    // Validate Aadhar card (should be 12 digits)
    if (userData.aadharCard && userData.aadharCard.trim() !== '') {
      const aadharPattern = /^\d{12}$/;
      if (!aadharPattern.test(userData.aadharCard.replace(/\s/g, ''))) {
        validationErrors.push('Aadhar card should be 12 digits');
      }
    }
    
    // Validate PAN card (should be 10 alphanumeric characters in specific format)
    if (userData.panCard && userData.panCard.trim() !== '') {
      const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panPattern.test(userData.panCard.replace(/\s/g, ''))) {
        validationErrors.push('PAN card should be in format ABCDE1234F (5 letters, 4 digits, 1 letter)');
      }
    }
    
    // Return validation errors if any
    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      return { 
        success: false, 
        error: 'Validation failed', 
        validationErrors 
      };
    }
    
    // Prepare data for update
    const updateData = {
      ...userData,
      updatedAt: serverTimestamp()
    };
    
    // Set proper isAdmin flag based on role
    if (userData.role) {
      updateData.isAdmin = userData.role === 'admin' || userData.role === 'subAdmin';
      updateData.isSuperAdmin = userData.role === 'admin';
    }
    
    // Use enhanced API from firestoreApi
    const result = await import('../api/firestoreApi').then(module => 
      module.updateUserData(userId, updateData)
    );
    
    // Pass through the result
    if (result.success) {
      console.log('✅ User details updated successfully');
      // Check for warnings
      if (result.warnings && result.warnings.length > 0) {
        return { 
          success: true,
          warnings: result.warnings 
        };
      }
      return { success: true };
    } else {
      console.error('❌ Error updating user details:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Error in updateUser:', error);
    return { success: false, error: error.message };
  }
}; 