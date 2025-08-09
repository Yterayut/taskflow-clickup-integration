// Create proper password hash for testing
const bcrypt = require('bcrypt');

async function createTestPassword() {
    const password = 'test123';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password:', password);
    console.log('Hash:', hash);
    
    // Test the hash
    const isValid = await bcrypt.compare(password, hash);
    console.log('Validation:', isValid);
}

createTestPassword();