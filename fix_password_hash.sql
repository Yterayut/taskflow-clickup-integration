-- Fix password hash in database
UPDATE users SET password_hash = '$2b$10$u3MyLXWjhFjijuYeaCs7YO4OU2owXGPMwu38iCdocddc.rMxM7rYm' 
WHERE email = 'yterayut@gmail.com';

SELECT email, password_hash FROM users WHERE email = 'yterayut@gmail.com';