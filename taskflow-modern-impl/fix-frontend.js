#!/usr/bin/env node
/**
 * Fix Frontend HTML - Add Missing Component Elements
 */

const fs = require('fs');
const path = require('path');

const MISSING_ELEMENTS = {
  'my-tasks': `
    <div class="section-header">
      <h2 class="section-title">My Tasks</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="openTaskModal()">
          <span>➕</span> New Task
        </button>
      </div>
    </div>
    <div id="myTasksList" class="task-list">
      <!-- Tasks will be rendered here -->
    </div>
  `,
  'team-overview': `
    <div class="section-header">
      <h2 class="section-title">Team Overview</h2>
      <div class="section-actions">
        <button class="btn btn-secondary" onclick="refreshTeamData()">
          <span>🔄</span> Refresh
        </button>
      </div>
    </div>
    <div id="teamOverviewGrid" class="team-grid">
      <!-- Team overview will be rendered here -->
    </div>
  `,
  'employee-management': `
    <div class="section-header">
      <h2 id="employeeManagementTitle" class="section-title">Employee Management</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="openEmployeeModal()">
          <span>👤</span> Add Employee
        </button>
      </div>
    </div>
    <div class="employee-search">
      <input type="text" id="employeeSearch" class="search-input-emp" placeholder="Search employees...">
    </div>
    <div id="employeeGrid" class="employee-grid">
      <!-- Employee cards will be rendered here -->
    </div>
  `,
  'team-ranking': `
    <div class="section-header">
      <h2 class="section-title">Team Ranking</h2>
      <div class="section-actions">
        <button class="btn btn-secondary" onclick="exportRanking()">
          <span>📊</span> Export
        </button>
      </div>
    </div>
    <div id="rankingGrid" class="ranking-grid">
      <!-- Ranking cards will be rendered here -->
    </div>
  `,
  'projects': `
    <div class="section-header">
      <h2 class="section-title">Projects</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="openProjectModal()">
          <span>📁</span> New Project
        </button>
      </div>
    </div>
    <div id="projectsContent" class="projects-content">
      <!-- Projects will be rendered here -->
    </div>
  `,
  'reports': `
    <div class="section-header">
      <h2 class="section-title">Reports</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="generateReport()">
          <span>📈</span> Generate
        </button>
      </div>
    </div>
    <div id="reportsContent" class="reports-content">
      <!-- Reports will be rendered here -->
    </div>
  `,
  'calendar': `
    <div class="section-header">
      <h2 class="section-title">Calendar</h2>
      <div class="section-actions">
        <button class="btn btn-secondary" onclick="toggleCalendarView()">
          <span>📅</span> Switch View
        </button>
      </div>
    </div>
    <div id="calendarContent" class="calendar-content">
      <!-- Calendar will be rendered here -->
    </div>
  `,
  'settings': `
    <div class="section-header">
      <h2 class="section-title">Settings</h2>
    </div>
    <div id="settingsContent" class="settings-content">
      <!-- Settings will be rendered here -->
    </div>
  `
};

const REMOTE_SCRIPT = `
# Download and apply frontend fixes
cd /var/www/taskflow

# Add missing elements to each component
${Object.entries(MISSING_ELEMENTS).map(([id, content]) => `
# Fix ${id} component
sudo sed -i '/<div id="${id}" class="component"[^>]*>/,/<\\/div>/ {
  /<div id="${id}" class="component"[^>]*>/ a\\
${content.replace(/'/g, "'\\''")}
}' index.html
`).join('\n')}

echo "✅ Frontend components fixed"
`;

console.log('🔧 Frontend Fix Script Generated');
console.log('Run this on the server:');
console.log(REMOTE_SCRIPT);