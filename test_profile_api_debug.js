/**
 * Debug Profile API Issue
 * Test JWT verification and profile endpoint
 */
const axios = require('axios');

async function testProfileAPI() {
    try {
        console.log('🔄 Testing JWT authentication and profile API...');
        
        // 1. Login to get JWT token
        console.log('1️⃣ Testing login...');
        const loginResponse = await axios.post('http://192.168.20.10:7812/api/v2/auth/login', {
            email: 'chaiwutwck@gmail.com',
            password: '12345'
        });
        
        console.log('✅ Login successful:', {
            status: loginResponse.status,
            success: loginResponse.data.success,
            userRole: loginResponse.data.user?.role
        });
        
        // Extract JWT token from Set-Cookie header
        const setCookieHeader = loginResponse.headers['set-cookie'];
        let jwtToken = null;
        
        if (setCookieHeader) {
            const tokenMatch = setCookieHeader[0].match(/taskflow_token=([^;]+)/);
            if (tokenMatch) {
                jwtToken = tokenMatch[1];
                console.log('🔑 JWT Token extracted:', {
                    length: jwtToken.length,
                    prefix: jwtToken.substring(0, 50) + '...'
                });
            }
        }
        
        if (!jwtToken) {
            throw new Error('No JWT token found in response');
        }
        
        // 2. Test profile API with JWT cookie
        console.log('2️⃣ Testing profile API with cookie...');
        try {
            const profileResponse = await axios.get('http://192.168.20.10:7812/api/v2/auth/profile', {
                headers: {
                    'Cookie': `taskflow_token=${jwtToken}`
                }
            });
            
            console.log('✅ Profile API successful:', {
                status: profileResponse.status,
                success: profileResponse.data.success,
                userEmail: profileResponse.data.user?.user?.email
            });
            
        } catch (profileError) {
            console.error('❌ Profile API failed:', {
                status: profileError.response?.status,
                error: profileError.response?.data,
                message: profileError.message
            });
        }
        
        // 3. Test profile API with Authorization header
        console.log('3️⃣ Testing profile API with Authorization header...');
        try {
            const profileAuthResponse = await axios.get('http://192.168.20.10:7812/api/v2/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`
                }
            });
            
            console.log('✅ Profile API with Authorization successful:', {
                status: profileAuthResponse.status,
                success: profileAuthResponse.data.success,
                userEmail: profileAuthResponse.data.user?.user?.email
            });
            
        } catch (profileAuthError) {
            console.error('❌ Profile API with Authorization failed:', {
                status: profileAuthError.response?.status,
                error: profileAuthError.response?.data,
                message: profileAuthError.message
            });
        }
        
        // 4. Decode JWT payload to check structure
        console.log('4️⃣ Analyzing JWT payload...');
        try {
            const payload = jwtToken.split('.')[1];
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
            
            console.log('🔍 JWT Payload:', {
                sub: decoded.sub,
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                iat: decoded.iat,
                exp: decoded.exp,
                iss: decoded.iss,
                aud: decoded.aud
            });
            
            // Check if token is expired
            const now = Math.floor(Date.now() / 1000);
            const isExpired = decoded.exp < now;
            console.log('⏰ Token status:', {
                isExpired,
                expiresIn: decoded.exp - now + ' seconds',
                issuedAt: new Date(decoded.iat * 1000).toISOString()
            });
            
        } catch (decodeError) {
            console.error('❌ JWT decode failed:', decodeError.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testProfileAPI().then(() => {
    console.log('🏁 Profile API debug test completed');
}).catch(error => {
    console.error('💥 Test crashed:', error);
});