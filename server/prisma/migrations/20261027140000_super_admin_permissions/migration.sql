-- Update super_admin role permissions to include all 18 system permissions
UPDATE "Role"
SET "permissions" = '["manageProjects","viewProjects","createProject","editProject","deleteProject","publishProject","manageCms","manageClients","managePastProjects","rollbackCms","manageUnits","viewInquiries","viewApplications","manageApplications","exportData","manageUsers","verifyUsers","manageNotifications"]'
WHERE "key" = 'super_admin' OR "id" = 'role_super_admin';

-- Update super_admin users: assign all 18 permissions and disable loginOtpEnabled
UPDATE "AdminUser"
SET
    "permissions" = '{"manageProjects":true,"viewProjects":true,"createProject":true,"editProject":true,"deleteProject":true,"publishProject":true,"manageCms":true,"manageClients":true,"managePastProjects":true,"rollbackCms":true,"manageUnits":true,"viewInquiries":true,"viewApplications":true,"manageApplications":true,"exportData":true,"manageUsers":true,"verifyUsers":true,"manageNotifications":true}',
    "loginOtpEnabled" = false
WHERE "role" = 'super_admin' OR "email" = 'admin@ajdaa.sa';
