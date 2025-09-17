/**
 * Data Models for CRM System
 * 
 * This file defines the data structures for:
 * - Admin: Super-admin with full access
 * - SubAdmin: Admins who manage specific users
 * - User: End users of the system
 */

/**
 * Admin Model
 * @typedef {Object} Admin
 * @property {string} id - Unique identifier
 * @property {string} email - Admin email
 * @property {string} displayName - Admin display name
 * @property {string} role - Always "admin"
 * @property {boolean} isAdmin - Always true
 * @property {boolean} isSuperAdmin - Always true
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * SubAdmin Model
 * @typedef {Object} SubAdmin
 * @property {string} id - Unique identifier
 * @property {string} email - SubAdmin email
 * @property {string} displayName - SubAdmin display name
 * @property {string} role - Always "subAdmin"
 * @property {boolean} isAdmin - Always true
 * @property {boolean} isSuperAdmin - Always false
 * @property {string[]} assignedUsers - Array of user IDs assigned to this subAdmin
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * User Model
 * @typedef {Object} User
 * @property {string} id - Unique identifier
 * @property {string} email - User email
 * @property {string} displayName - User display name
 * @property {string} phone - User phone number
 * @property {string} address - User address
 * @property {string} aadharCard - Aadhar card number
 * @property {string} panCard - PAN card number
 * @property {string} assignedTo - ID of the subAdmin this user is assigned to
 * @property {string} role - Always "user"
 * @property {string} status - "active" or "inactive"
 * @property {Object[]} activityHistory - Array of user activities
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Activity Model
 * @typedef {Object} Activity
 * @property {string} id - Unique identifier
 * @property {string} userId - ID of the user
 * @property {string} type - Type of activity
 * @property {string} description - Activity description
 * @property {string} performedBy - ID of admin/subAdmin who performed the action
 * @property {Date} timestamp - When the activity occurred
 */

// Default data structure creators
export const createAdminData = (id, email, displayName) => ({
  id,
  email,
  displayName,
  role: 'admin',
  isAdmin: true,
  isSuperAdmin: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createSubAdminData = (id, email, displayName) => ({
  id,
  email,
  displayName,
  role: 'subAdmin',
  isAdmin: true,
  isSuperAdmin: false,
  assignedUsers: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createUserData = (id, email, displayName, assignedTo = null) => ({
  id,
  email,
  displayName,
  phone: '',
  address: '',
  aadharCard: '',
  panCard: '',
  assignedTo,
  role: 'user',
  status: 'active',
  activityHistory: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createActivity = (userId, type, description, performedBy) => ({
  id: Math.random().toString(36).substr(2, 9),
  userId,
  type,
  description,
  performedBy,
  timestamp: new Date()
}); 