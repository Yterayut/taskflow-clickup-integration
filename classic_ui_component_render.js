// Classic UI Component Rendering Logic
// ฟังก์ชันแสดงข้อมูลต่างกันตาม activeComponent

// 1. เพิ่ม component data loading function
const loadComponentData = async (component) => {
    console.log(`Loading data for component: ${component}`);
    
    switch(component) {
        case 'team':
            try {
                const response = await fetch('http://192.168.20.10:7812/api/v2/team/overview');
                if (response.ok) {
                    const data = await response.json();
                    console.log('Team data loaded:', data);
                    return data;
                }
            } catch (error) {
                console.error('Failed to load team data:', error);
            }
            break;
            
        case 'tasks':
            try {
                const response = await fetch('http://192.168.20.10:7812/api/v2/tasks/my-tasks');
                if (response.ok) {
                    const data = await response.json();
                    console.log('Tasks data loaded:', data);
                    return data;
                }
            } catch (error) {
                console.error('Failed to load tasks data:', error);
            }
            break;
            
        case 'projects':
            try {
                const response = await fetch('http://192.168.20.10:7812/api/v2/projects');
                if (response.ok) {
                    const data = await response.json();
                    console.log('Projects data loaded:', data);
                    return data;
                }
            } catch (error) {
                console.error('Failed to load projects data:', error);
            }
            break;
            
        default:
            // Dashboard - use existing data
            console.log('Dashboard - using existing data');
            return null;
    }
};

// 2. Component rendering function
const renderComponentContent = (activeComponent, componentData = null) => {
    switch(activeComponent) {
        case 'team':
            return `
                <div className="page-header">
                    <h1 className="page-title">Team Management</h1>
                    <p className="page-subtitle">การจัดการทีมงานและการมอบหมายงาน</p>
                </div>
                <div className="component-section">
                    <h2>👥 รายชื่อทีม (${componentData?.totalMembers || 'กำลังโหลด...'})</h2>
                    <div className="team-grid">
                        ${componentData?.team ? componentData.team.map(member => `
                            <div className="team-member-card">
                                <h3>${member.username}</h3>
                                <p>งานที่ได้รับมอบหมาย: ${member.assigned_tasks}</p>
                                <p>งานที่เสร็จแล้ว: ${member.completed_tasks}</p>
                            </div>
                        `).join('') : '<p>กำลังโหลดข้อมูลทีม...</p>'}
                    </div>
                </div>
            `;
            
        case 'tasks':
            return `
                <div className="page-header">
                    <h1 className="page-title">Task Center</h1>
                    <p className="page-subtitle">ศูนย์จัดการงานทั้งหมด</p>
                </div>
                <div className="component-section">
                    <h2>📋 งานของฉัน (${componentData?.totalTasks || 'กำลังโหลด...'})</h2>
                    <div className="tasks-grid">
                        ${componentData?.tasks ? componentData.tasks.map(task => `
                            <div className="task-card">
                                <h3>${task.name}</h3>
                                <p>สถานะ: ${task.status}</p>
                                <p>ความสำคัญ: ${task.priority}</p>
                            </div>
                        `).join('') : '<p>กำลังโหลดข้อมูลงาน...</p>'}
                    </div>
                </div>
            `;
            
        case 'analytics':
            return `
                <div className="page-header">
                    <h1 className="page-title">Analytics</h1>
                    <p className="page-subtitle">การวิเคราะห์และรายงาน</p>
                </div>
                <div className="component-section">
                    <h2>📈 สถิติการทำงาน</h2>
                    <p>กราฟและสถิติการทำงานของทีมจะแสดงที่นี่</p>
                </div>
            `;
            
        case 'projects':
            return `
                <div className="page-header">
                    <h1 className="page-title">Projects</h1>
                    <p className="page-subtitle">การจัดการโปรเจคต์</p>
                </div>
                <div className="component-section">
                    <h2>📁 โปรเจคต์ (${componentData?.totalProjects || 'กำลังโหลด...'})</h2>
                    <div className="projects-grid">
                        ${componentData?.projects ? componentData.projects.map(project => `
                            <div className="project-card">
                                <h3>${project.name}</h3>
                                <p>งานทั้งหมด: ${project.total_tasks}</p>
                                <p>เสร็จแล้ว: ${project.completed_tasks}</p>
                                <p>กำลังดำเนินการ: ${project.in_progress_tasks}</p>
                            </div>
                        `).join('') : '<p>กำลังโหลดข้อมูลโปรเจคต์...</p>'}
                    </div>
                </div>
            `;
            
        case 'settings':
            return `
                <div className="page-header">
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">การตั้งค่าระบบ</p>
                </div>
                <div className="component-section">
                    <h2>⚙️ การตั้งค่า</h2>
                    <p>หน้าการตั้งค่าระบบจะแสดงที่นี่</p>
                </div>
            `;
            
        default: // dashboard
            return `
                <div className="page-header">
                    <h1 className="page-title">Team Dashboard</h1>
                    <p className="page-subtitle">ภาพรวมการทำงานของทีม • อัพเดทล่าสุด: {new Date().toLocaleString('th-TH')}</p>
                </div>
                <!-- Keep existing dashboard content -->
            `;
    }
};

// 3. CSS สำหรับ component content
const componentCSS = `
    .component-section {
        background: white;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        border: 1px solid #e5e7eb;
    }
    
    .team-grid, .tasks-grid, .projects-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
        margin-top: 16px;
    }
    
    .team-member-card, .task-card, .project-card {
        background: #f9fafb;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #d1d5db;
    }
    
    .team-member-card h3, .task-card h3, .project-card h3 {
        color: #1f2937;
        margin-bottom: 8px;
        font-size: 16px;
    }
    
    .team-member-card p, .task-card p, .project-card p {
        color: #6b7280;
        font-size: 14px;
        margin-bottom: 4px;
    }
`;

console.log('Classic UI Component Rendering Logic Ready');