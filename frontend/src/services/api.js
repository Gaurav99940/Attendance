import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartface_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on 401 if unauthorized
      // localStorage.removeItem('smartface_token');
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
};

export const employeeApi = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (employeeId) => api.get(`/employees/${employeeId}`),
  create: (data) => api.post('/employees', data),
  update: (employeeId, data) => api.put(`/employees/${employeeId}`, data),
  delete: (employeeId) => api.delete(`/employees/${employeeId}`),
  uploadFaces: (employeeId, formData) =>
    api.post(`/employees/${employeeId}/faces`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteFace: (employeeId, faceId) => api.delete(`/employees/${employeeId}/faces/${faceId}`),
};

export const attendanceApi = {
  getHistory: (params) => api.get('/attendance', { params }),
  getToday: () => api.get('/attendance/today'),
  getEmployeeAttendance: (employeeId, params) => api.get(`/attendance/employee/${employeeId}`, { params }),
  getEmployeeAttendanceByDate: (employeeId, date) => api.get(`/attendance/employee/${employeeId}/date/${date}`),
  getAttendanceDetails: (id) => api.get(`/attendance/details/${id}`),
  getCalendar: (params) => api.get('/attendance/calendar', { params }),
  manualOverride: (data) => api.post('/attendance/manual', data),
  deleteRecord: (id) => api.delete(`/attendance/${id}`),
};

export const cameraApi = {
  processFrame: (data) => api.post('/camera/process-frame', data),
  processGateFrame: (data) => api.post('/camera/process-gate-frame', data),
  testConnection: () => api.post('/camera/test-connection'),
  getSources: () => api.get('/camera/sources'),
  simulatePunch: (data) => api.post('/camera/simulate-punch', data),
  getStatus: () => api.get('/camera/status'),
  getStreamUrl: (cameraId, view = 'auto') => `${API_BASE_URL}/camera/stream/${cameraId || 'CAM_GATE_01'}?view=${view}`,
  getFrameUrl: (cameraId, view = 'auto') => `${API_BASE_URL}/camera/frame/${cameraId || 'CAM_GATE_01'}?view=${view}`,
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export const reportsApi = {
  getReports: (params) => api.get('/reports', { params }),
  getExportCsvUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `/api/reports/export/csv?${query}`;
  },
  getExportExcelUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `/api/reports/export/excel?${query}`;
  },
};

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
  getShifts: () => api.get('/settings/shifts'),
  createShift: (data) => api.post('/settings/shifts', data),
  updateShift: (id, data) => api.put(`/settings/shifts/${id}`, data),
  deleteShift: (id) => api.delete(`/settings/shifts/${id}`),
  reseedDemo: () => api.post('/settings/seed-demo'),
  clearDemo: () => api.post('/settings/clear-demo'),
  getDatabaseStatus: () => api.get('/settings/database-status'),
  connectMongoDB: (data) => api.post('/settings/connect-mongodb', data),
};

export const unknownApi = {
  getAll: () => api.get('/unknown'),
  dismiss: (id) => api.delete(`/unknown/${id}`),
  assignToEmployee: (id, employeeId) => api.post(`/unknown/${id}/assign/${employeeId}`),
};

export const auditApi = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

export const portalApi = {
  login: (emailOrId, password) => api.post('/employee/login', { employeeIdOrEmail: emailOrId, password }),
  getMe: () => api.get('/employee/me'),
  updateProfile: (data) => api.put('/employee/profile', data),
  changePassword: (data) => api.put('/employee/password', data),
  getDashboard: () => api.get('/employee/dashboard'),
  getToday: () => api.get('/employee/today'),
  getAttendance: (params) => api.get('/employee/attendance', { params }),
  getAttendanceByDate: (date) => api.get(`/employee/attendance/${date}`),
  getCalendar: (params) => api.get('/employee/calendar', { params }),
  getSummary: (params) => api.get('/employee/summary', { params }),
  getShift: () => api.get('/employee/shift'),
  getLeaves: () => api.get('/employee/leaves'),
  applyLeave: (data) => api.post('/employee/leaves', data),
  cancelLeave: (id) => api.delete(`/employee/leaves/${id}`),
  getRegularizations: () => api.get('/employee/attendance-corrections'),
  applyRegularization: (data) => api.post('/employee/attendance-correction', data),
  getNotifications: () => api.get('/employee/notifications'),
  markNotificationsRead: () => api.post('/employee/notifications/mark-read'),
  getAnnouncements: () => api.get('/employee/announcements'),
  getHolidays: () => api.get('/employee/holidays'),
  registerFace: (formData) =>
    api.post('/employee/register-face', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const adminLeavesApi = {
  getLeaves: (params) => api.get('/admin/leaves', { params }),
  updateLeaveStatus: (id, data) => api.put(`/admin/leaves/${id}/status`, data),
  approveLeave: (leaveRequestId, adminRemarks) =>
    api.patch(`/admin/leaves/${leaveRequestId}/approve`, { adminRemarks }),
  rejectLeave: (leaveRequestId, adminRemarks) =>
    api.patch(`/admin/leaves/${leaveRequestId}/reject`, { adminRemarks }),
  getRegularizations: (params) => api.get('/admin/regularization', { params }),
  updateRegularizationStatus: (id, data) => api.put(`/admin/regularization/${id}/status`, data),
  approveRegularization: (regRequestId, adminRemarks) =>
    api.patch(`/admin/regularization/${regRequestId}/approve`, { adminRemarks }),
  rejectRegularization: (regRequestId, adminRemarks) =>
    api.patch(`/admin/regularization/${regRequestId}/reject`, { adminRemarks }),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
  resetEmployeePassword: (employeeId, data) => api.post(`/employees/${employeeId}/reset-password`, data),
};

export default api;


