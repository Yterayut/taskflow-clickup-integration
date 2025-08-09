        // Real employee data from team-workload
        const [teamData, setTeamData] = useState({
            frontend: [
                { id: 1, name: 'กิตติพงษ์ สมศรี', role: 'Senior Developer', tasks: '7/10', progress: 70, avatar: 'ก', status: 'available' },
                { id: 2, name: 'นภัสสร จันทร์เพ็ญ', role: 'UI/UX Designer', tasks: '4/8', progress: 50, avatar: 'น', status: 'busy' },
                { id: 3, name: 'มานี เก่งมาก', role: 'QA Tester', tasks: '6/8', progress: 75, avatar: 'ม', status: 'available' }
            ],
            backend: [
                { id: 4, name: 'สมชาย พัฒนา', role: 'Backend Developer', tasks: '8/12', progress: 66, avatar: 'ส', status: 'available' },
                { id: 5, name: 'วิทยา ดาต้าเบส', role: 'Database Admin', tasks: '5/8', progress: 62, avatar: 'ว', status: 'busy' }
            ]
        });

        const [employeeTasks, setEmployeeTasks] = useState([
            {
                id: 1,
                title: 'ออกแบบ Dashboard UI',
                priority: 'high',
                status: 'progress',
                progress: 75,
                dueDate: '25 มิ.ย. 2025',
                timeSpent: '12/16 ชม.',
                project: 'TaskFlow Pro',
                tags: ['#ui', '#dashboard', '#design']
            },
            {
                id: 2,
                title: 'พัฒนา API สำหรับ User Management',
                priority: 'medium',
                status: 'progress',
                progress: 60,
                dueDate: '22 มิ.ย. 2025',
                timeSpent: '8/12 ชม.',
                project: 'TaskFlow Backend',
                tags: ['#api', '#backend', '#user']
            },
            {
                id: 3,
                title: 'ทดสอบระบบ Authentication',
                priority: 'high',
                status: 'completed',
                progress: 100,
                dueDate: '20 มิ.ย. 2025',
                timeSpent: '6/6 ชม.',
                project: 'Security Testing',
                tags: ['#testing', '#auth', '#security']
            },
            {
                id: 4,
                title: 'เขียนเอกสาร User Manual',
                priority: 'low',
                status: 'todo',
                progress: 0,
                dueDate: '30 มิ.ย. 2025',
                timeSpent: '0/8 ชม.',
                project: 'Documentation',
                tags: ['#docs', '#manual']
            }
        ]);