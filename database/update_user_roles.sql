-- TaskFlow Pro v3.3 - Update User Roles Migration
-- Date: July 5, 2025
-- Purpose: Update user roles according to new organizational structure

-- Update Manager role
UPDATE users 
SET role = 'manager', updated_at = NOW()
WHERE email = 'yterayut@gmail.com';

-- Update Team Lead role  
UPDATE users 
SET role = 'team_lead', updated_at = NOW()
WHERE email = 'chaiwutwck@gmail.com';

-- Update Employee roles (change from 'user' to 'employee')
UPDATE users 
SET role = 'employee', updated_at = NOW()
WHERE email IN (
    'atthakorn.na@ku.th',
    'sahassavas.rim@gmail.com',
    'primshi1719@gmail.com',
    'panuwantung@gmail.com',
    'jirapat.sripanya@gmail.com',
    'chutithep_ar@kkumail.com',
    'pongsanzakom@gmail.com',
    'nisareen.dk@gmail.com',
    'jthammakit2546@gmail.com'
);

-- Verify the updates
SELECT 
    email,
    full_name,
    role,
    updated_at
FROM users
ORDER BY 
    CASE role
        WHEN 'master' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'team_lead' THEN 3
        WHEN 'employee' THEN 4
        WHEN 'user' THEN 5
        ELSE 6
    END,
    email;

-- Summary report
SELECT 
    role,
    COUNT(*) as user_count
FROM users
GROUP BY role
ORDER BY 
    CASE role
        WHEN 'master' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'team_lead' THEN 3
        WHEN 'employee' THEN 4
        WHEN 'user' THEN 5
        ELSE 6
    END;

-- Log the migration
INSERT INTO system_status (clickup_connected, last_health_check, total_active_sessions)
VALUES (
    (SELECT clickup_connected FROM system_status ORDER BY updated_at DESC LIMIT 1),
    NOW(),
    0
);

SELECT 'User Roles Migration Completed Successfully' as status;