// Advanced Reporting System for TaskFlow Pro
// Export real ClickUp data to various formats
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Excel Export Endpoint
app.get('/api/v2/reports/export/excel', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { format = 'tasks', dateFrom, dateTo } = req.query;
        
        console.log(`[${new Date().toISOString()}] 📊 Generating Excel report: ${format}`);
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'TaskFlow Pro v13.0.0';
        workbook.created = new Date();
        
        if (format === 'tasks' || format === 'all') {
            await generateTasksSheet(workbook, dateFrom, dateTo);
        }
        
        if (format === 'team' || format === 'all') {
            await generateTeamSheet(workbook);
        }
        
        if (format === 'analytics' || format === 'all') {
            await generateAnalyticsSheet(workbook);
        }
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=TaskFlow_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        // Send the workbook
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate Excel report',
            error: error.message
        });
    }
});

// PDF Export Endpoint
app.get('/api/v2/reports/export/pdf', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { type = 'summary' } = req.query;
        
        console.log(`[${new Date().toISOString()}] 📄 Generating PDF report: ${type}`);
        
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=TaskFlow_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        
        doc.pipe(res);
        
        // Generate PDF content
        await generatePDFReport(doc, type);
        
        doc.end();
        
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate PDF report',
            error: error.message
        });
    }
});

// CSV Export Endpoint
app.get('/api/v2/reports/export/csv', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { type = 'tasks' } = req.query;
        
        console.log(`[${new Date().toISOString()}] 📄 Generating CSV report: ${type}`);
        
        let csvContent = '';
        let filename = 'TaskFlow_Export.csv';
        
        switch(type) {
            case 'tasks':
                csvContent = await generateTasksCSV();
                filename = `TaskFlow_Tasks_${new Date().toISOString().split('T')[0]}.csv`;
                break;
            case 'team':
                csvContent = await generateTeamCSV();
                filename = `TaskFlow_Team_${new Date().toISOString().split('T')[0]}.csv`;
                break;
            case 'assignments':
                csvContent = await generateAssignmentsCSV();
                filename = `TaskFlow_Assignments_${new Date().toISOString().split('T')[0]}.csv`;
                break;
        }
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        
        // Add BOM for UTF-8
        res.write('\ufeff');
        res.write(csvContent);
        res.end();
        
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate CSV report',
            error: error.message
        });
    }
});

// Report Status Endpoint
app.get('/api/v2/reports/status', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_tasks,
                (SELECT COUNT(*) FROM clickup_members WHERE is_active = true) as active_members,
                (SELECT COUNT(*) FROM clickup_task_assignments) as total_assignments,
                (SELECT COUNT(*) FROM clickup_spaces) as total_projects,
                MAX(date_updated) as last_task_update
            FROM clickup_tasks 
            WHERE archived = false
        `);
        
        const result = stats.rows[0];
        
        res.json({
            success: true,
            data: {
                availableReports: [
                    {
                        type: 'tasks',
                        name: 'Tasks Report',
                        description: 'Complete list of all tasks with assignments and status',
                        formats: ['excel', 'csv', 'pdf'],
                        recordCount: parseInt(result.total_tasks)
                    },
                    {
                        type: 'team',
                        name: 'Team Performance Report',
                        description: 'Team member productivity and assignment statistics',
                        formats: ['excel', 'csv', 'pdf'],
                        recordCount: parseInt(result.active_members)
                    },
                    {
                        type: 'analytics',
                        name: 'Analytics Summary',
                        description: 'Dashboard analytics with trends and distributions',
                        formats: ['excel', 'pdf'],
                        recordCount: 1
                    },
                    {
                        type: 'assignments',
                        name: 'Task Assignments',
                        description: 'Task-to-member assignment relationships',
                        formats: ['csv', 'excel'],
                        recordCount: parseInt(result.total_assignments)
                    }
                ],
                dataStatus: {
                    totalTasks: parseInt(result.total_tasks),
                    completedTasks: parseInt(result.completed_tasks),
                    activeMembers: parseInt(result.active_members),
                    totalAssignments: parseInt(result.total_assignments),
                    totalProjects: parseInt(result.total_projects),
                    lastUpdate: result.last_task_update ? new Date(parseInt(result.last_task_update)).toISOString() : null,
                    dataSource: 'Real ClickUp Data (PostgreSQL)'
                }
            }
        });
        
    } catch (error) {
        console.error('Report status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get report status',
            error: error.message
        });
    }
});

// Helper Functions
async function generateTasksSheet(workbook, dateFrom, dateTo) {
    const worksheet = workbook.addWorksheet('Tasks Report');
    
    // Set column headers
    worksheet.columns = [
        { header: 'Task ID', key: 'id', width: 15 },
        { header: 'Task Name', key: 'name', width: 40 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Status', key: 'status_name', width: 15 },
        { header: 'Priority', key: 'priority_name', width: 15 },
        { header: 'Assigned To', key: 'assigned_to', width: 25 },
        { header: 'Space/Project', key: 'space_name', width: 20 },
        { header: 'List', key: 'list_name', width: 20 },
        { header: 'Due Date', key: 'due_date', width: 15 },
        { header: 'Created', key: 'date_created', width: 15 },
        { header: 'Updated', key: 'date_updated', width: 15 },
        { header: 'Is Subtask', key: 'is_subtask', width: 12 }
    ];
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    // Get tasks data
    let query = `
        SELECT DISTINCT
            t.id,
            t.name,
            t.description,
            t.status_name,
            t.priority_name,
            m.username as assigned_to,
            t.space_name,
            t.list_name,
            t.due_date,
            t.date_created,
            t.date_updated,
            CASE WHEN t.parent IS NOT NULL THEN 'Yes' ELSE 'No' END as is_subtask
        FROM clickup_tasks t
        LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
        LEFT JOIN clickup_members m ON ta.member_id = m.id
        WHERE t.archived = false
    `;
    
    const params = [];
    
    if (dateFrom) {
        query += ` AND t.date_created >= $${params.length + 1}`;
        params.push(new Date(dateFrom).getTime());
    }
    
    if (dateTo) {
        query += ` AND t.date_created <= $${params.length + 1}`;
        params.push(new Date(dateTo).getTime());
    }
    
    query += ` ORDER BY t.date_updated DESC`;
    
    const result = await pool.query(query, params);
    
    // Add data rows
    result.rows.forEach(task => {
        worksheet.addRow({
            ...task,
            due_date: task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : '',
            date_created: task.date_created ? new Date(parseInt(task.date_created)).toLocaleDateString() : '',
            date_updated: task.date_updated ? new Date(parseInt(task.date_updated)).toLocaleDateString() : ''
        });
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 12);
    });
}

async function generateTeamSheet(workbook) {
    const worksheet = workbook.addWorksheet('Team Performance');
    
    worksheet.columns = [
        { header: 'Member ID', key: 'id', width: 12 },
        { header: 'Name', key: 'username', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Total Assigned', key: 'total_assigned', width: 15 },
        { header: 'Completed', key: 'completed', width: 12 },
        { header: 'In Progress', key: 'in_progress', width: 12 },
        { header: 'Completion Rate %', key: 'completion_rate', width: 18 },
        { header: 'Active', key: 'is_active', width: 10 }
    ];
    
    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    const result = await pool.query(`
        SELECT 
            m.id,
            m.username,
            m.email,
            m.role,
            m.is_active,
            COUNT(ta.task_id) as total_assigned,
            COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed,
            COUNT(CASE WHEN t.status_name ILIKE '%progress%' THEN 1 END) as in_progress,
            ROUND((COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(ta.task_id), 0)), 2) as completion_rate
        FROM clickup_members m
        LEFT JOIN clickup_task_assignments ta ON m.id = ta.member_id
        LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.archived = false
        GROUP BY m.id, m.username, m.email, m.role, m.is_active
        ORDER BY completion_rate DESC, total_assigned DESC
    `);
    
    result.rows.forEach(member => {
        worksheet.addRow({
            ...member,
            is_active: member.is_active ? 'Yes' : 'No',
            completion_rate: member.completion_rate || 0
        });
    });
}

async function generateTasksCSV() {
    const result = await pool.query(`
        SELECT DISTINCT
            t.id,
            t.name,
            t.description,
            t.status_name,
            t.priority_name,
            m.username as assigned_to,
            t.space_name,
            t.list_name,
            CASE WHEN t.due_date IS NOT NULL THEN to_timestamp(t.due_date::bigint / 1000)::date ELSE NULL END as due_date,
            to_timestamp(t.date_created::bigint / 1000)::date as date_created,
            to_timestamp(t.date_updated::bigint / 1000)::date as date_updated,
            CASE WHEN t.parent IS NOT NULL THEN 'Yes' ELSE 'No' END as is_subtask
        FROM clickup_tasks t
        LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
        LEFT JOIN clickup_members m ON ta.member_id = m.id
        WHERE t.archived = false
        ORDER BY t.date_updated DESC
    `);
    
    const headers = ['Task ID', 'Task Name', 'Description', 'Status', 'Priority', 'Assigned To', 'Space/Project', 'List', 'Due Date', 'Created', 'Updated', 'Is Subtask'];
    let csv = headers.join(',') + '\n';
    
    result.rows.forEach(row => {
        const values = [
            `"${row.id || ''}"`,
            `"${(row.name || '').replace(/"/g, '""')}"`,
            `"${(row.description || '').replace(/"/g, '""')}"`,
            `"${row.status_name || ''}"`,
            `"${row.priority_name || ''}"`,
            `"${row.assigned_to || ''}"`,
            `"${row.space_name || ''}"`,
            `"${row.list_name || ''}"`,
            `"${row.due_date || ''}"`,
            `"${row.date_created || ''}"`,
            `"${row.date_updated || ''}"`,
            `"${row.is_subtask || 'No'}"`
        ];
        csv += values.join(',') + '\n';
    });
    
    return csv;
}

module.exports = {
    excelExportEndpoint: '/api/v2/reports/export/excel',
    pdfExportEndpoint: '/api/v2/reports/export/pdf',
    csvExportEndpoint: '/api/v2/reports/export/csv',
    reportStatusEndpoint: '/api/v2/reports/status'
};