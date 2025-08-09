// Fix updateDashboard function to match actual backend response
function updateDashboard(response) {
    // Backend returns: {success: true, data: {...}}
    const data = response.data;
    
    // Update overview cards with actual backend data
    document.getElementById('totalTasks').textContent = data.totalTasks || 0;
    document.getElementById('mainTasks').textContent = data.totalTasks || 0; // Use totalTasks as mainTasks
    document.getElementById('subtasks').textContent = 0; // Backend doesn't provide subtasks count
    document.getElementById('completedTasks').textContent = data.completedTasks || 0;
    document.getElementById('completionRate').textContent = `${data.completionRate || 0}%`;
    document.getElementById('inProgressTasks').textContent = data.inProgressTasks || 0;
    document.getElementById('overdueTasks').textContent = 0; // Backend doesn't provide overdue
    document.getElementById('teamMembers').textContent = data.teamMembers || 0;
    document.getElementById('performanceGrade').textContent = getPerformanceGrade(data.completionRate || 0);
    
    // Update task count badge
    const taskCountBadge = document.getElementById('taskCount');
    if (taskCountBadge) {
        taskCountBadge.textContent = data.totalTasks || 0;
    }

    // Update data source indicator
    const dataSourceElement = document.querySelector('.data-source-indicator');
    if (dataSourceElement) {
        dataSourceElement.className = 'data-source-indicator real-data';
        dataSourceElement.innerHTML = `
            <i class="fas fa-database"></i>
            ${data.dataSource || 'Real ClickUp Data (PostgreSQL)'} - อัปเดตล่าสุด: ${formatLastSync(data.lastSync)}
        `;
    }
}