/**
 * Quick Fix for Sync Service - Fix timestamp and data issues
 */
const fs = require('fs');
const path = require('path');

function fixSyncService() {
    console.log('🔧 Applying quick fixes to sync service...');
    
    // Read sync service file
    const servicePath = path.join(__dirname, 'application/services/ClickUpSyncService.js');
    let content = fs.readFileSync(servicePath, 'utf8');
    
    // Fix timestamp conversion function
    const timestampFix = `
    /**
     * Convert ClickUp timestamp to PostgreSQL format
     */
    convertClickUpTimestamp(timestamp) {
        if (!timestamp) return null;
        
        // ClickUp sometimes sends timestamps in milliseconds since epoch
        const timestampNum = parseInt(timestamp);
        if (timestampNum > 1000000000000) {
            // Milliseconds, convert to seconds
            return new Date(timestampNum).toISOString();
        } else if (timestampNum > 1000000000) {
            // Seconds since epoch
            return new Date(timestampNum * 1000).toISOString();
        }
        
        // Try to parse as ISO string
        try {
            return new Date(timestamp).toISOString();
        } catch {
            return null;
        }
    }
`;

    // Add the timestamp fix method to the class
    const insertPoint = content.indexOf('    /**\n     * Perform full sync from ClickUp API to local database');
    if (insertPoint !== -1) {
        content = content.slice(0, insertPoint) + timestampFix + '\n    ' + content.slice(insertPoint);
    }

    // Fix member sync to use convertClickUpTimestamp
    content = content.replace(
        'memberData.last_active,',
        'this.convertClickUpTimestamp(memberData.last_active),'
    );
    content = content.replace(
        'memberData.date_joined,',
        'this.convertClickUpTimestamp(memberData.date_joined),'
    );
    content = content.replace(
        'memberData.date_invited,',
        'this.convertClickUpTimestamp(memberData.date_invited),'
    );

    // Fix task sync timestamp fields
    content = content.replace(
        'taskData.date_created,',
        'this.convertClickUpTimestamp(taskData.date_created),'
    );
    content = content.replace(
        'taskData.date_updated,',
        'this.convertClickUpTimestamp(taskData.date_updated),'
    );
    content = content.replace(
        'taskData.date_closed,',
        'this.convertClickUpTimestamp(taskData.date_closed),'
    );
    content = content.replace(
        'taskData.date_done,',
        'this.convertClickUpTimestamp(taskData.date_done),'
    );
    content = content.replace(
        'taskData.due_date,',
        'this.convertClickUpTimestamp(taskData.due_date),'
    );
    content = content.replace(
        'taskData.start_date,',
        'this.convertClickUpTimestamp(taskData.start_date),'
    );

    // Write fixed service
    fs.writeFileSync(servicePath, content);
    console.log('✅ Sync service fixes applied');
}

// Run fix
if (require.main === module) {
    try {
        fixSyncService();
    } catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    }
}

module.exports = { fixSyncService };