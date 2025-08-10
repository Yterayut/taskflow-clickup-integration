                            {/* Team Management Content */}
                            {activeComponent === "team" && (
                                <div>
                                    <div className="component-content">
                                        <h2>👥 Team Overview</h2>
                                        {componentData ? (
                                            <div>
                                                <p>Total Members: <strong>{componentData.totalMembers}</strong></p>
                                                <div className="team-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '20px'}}>
                                                    {componentData.team && componentData.team.map((member, index) => (
                                                        <div key={index} className="team-member-card" style={{background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px'}}>
                                                            <h3 style={{color: '#1f2937', marginBottom: '8px'}}>{member.username}</h3>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Email: {member.email}</p>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Assigned Tasks: <strong>{member.assigned_tasks}</strong></p>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Completed Tasks: <strong>{member.completed_tasks}</strong></p>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Role: {member.role}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p>🔄 กำลังโหลดข้อมูลทีม...</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Tasks Content */}
                            {activeComponent === "tasks" && (
                                <div>
                                    <div className="component-content">
                                        <h2>📋 My Tasks</h2>
                                        {componentData ? (
                                            <div>
                                                <p>Total Tasks: <strong>{componentData.totalTasks}</strong></p>
                                                <div className="tasks-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px', marginTop: '20px'}}>
                                                    {componentData.tasks && componentData.tasks.map((task, index) => (
                                                        <div key={index} className="task-card" style={{background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px'}}>
                                                            <h3 style={{color: '#1f2937', marginBottom: '8px'}}>{task.name}</h3>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Status: <span style={{color: task.status === 'complete' ? '#059669' : task.status === 'in progress' ? '#d97706' : '#dc2626', fontWeight: 'bold'}}>{task.status}</span></p>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Priority: <span style={{color: task.priority === 'urgent' ? '#dc2626' : task.priority === 'high' ? '#d97706' : '#6b7280', fontWeight: 'bold'}}>{task.priority}</span></p>
                                                            {task.due_date && <p style={{color: '#6b7280', fontSize: '14px'}}>Due Date: {new Date(parseInt(task.due_date)).toLocaleDateString('th-TH')}</p>}
                                                            {task.description && <p style={{color: '#6b7280', fontSize: '14px', marginTop: '8px'}}>{task.description}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p>🔄 กำลังโหลดข้อมูลงาน...</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Projects Content */}
                            {activeComponent === "projects" && (
                                <div>
                                    <div className="component-content">
                                        <h2>📁 Projects</h2>
                                        {componentData ? (
                                            <div>
                                                <p>Total Projects: <strong>{componentData.totalProjects}</strong></p>
                                                <div className="projects-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '20px'}}>
                                                    {componentData.projects && componentData.projects.map((project, index) => (
                                                        <div key={index} className="project-card" style={{background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px'}}>
                                                            <h3 style={{color: '#1f2937', marginBottom: '8px'}}>{project.name}</h3>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Total Tasks: <strong>{project.total_tasks}</strong></p>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>Completed: <strong>{project.completed_tasks}</strong></p>
                                                            <p style={{color: '#6b7280', fontSize: '14px'}}>In Progress: <strong>{project.in_progress_tasks}</strong></p>
                                                            <div style={{width: '100%', background: '#e5e7eb', borderRadius: '4px', marginTop: '8px', height: '8px'}}>
                                                                <div style={{width: `${(project.completed_tasks / project.total_tasks) * 100}%`, background: '#059669', height: '100%', borderRadius: '4px'}}></div>
                                                            </div>
                                                            <p style={{color: '#6b7280', fontSize: '12px', marginTop: '4px'}}>Progress: {Math.round((project.completed_tasks / project.total_tasks) * 100)}%</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p>🔄 กำลังโหลดข้อมูลโปรเจคต์...</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Analytics Content */}
                            {activeComponent === "analytics" && (
                                <div>
                                    <div className="component-content">
                                        <h2>📈 Analytics</h2>
                                        {componentData ? (
                                            <div>
                                                <div className="analytics-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginTop: '20px'}}>
                                                    <div className="analytics-card" style={{background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '8px', padding: '16px', textAlign: 'center'}}>
                                                        <h3 style={{color: '#1e40af', marginBottom: '8px'}}>Total Tasks</h3>
                                                        <p style={{fontSize: '24px', fontWeight: 'bold', color: '#1e40af'}}>{componentData.totalTasks}</p>
                                                    </div>
                                                    <div className="analytics-card" style={{background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '16px', textAlign: 'center'}}>
                                                        <h3 style={{color: '#15803d', marginBottom: '8px'}}>Completed</h3>
                                                        <p style={{fontSize: '24px', fontWeight: 'bold', color: '#15803d'}}>{componentData.completedTasks}</p>
                                                    </div>
                                                    <div className="analytics-card" style={{background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', textAlign: 'center'}}>
                                                        <h3 style={{color: '#d97706', marginBottom: '8px'}}>In Progress</h3>
                                                        <p style={{fontSize: '24px', fontWeight: 'bold', color: '#d97706'}}>{componentData.inProgressTasks}</p>
                                                    </div>
                                                    <div className="analytics-card" style={{background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', textAlign: 'center'}}>
                                                        <h3 style={{color: '#dc2626', marginBottom: '8px'}}>To Do</h3>
                                                        <p style={{fontSize: '24px', fontWeight: 'bold', color: '#dc2626'}}>{componentData.todoTasks}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p>🔄 กำลังโหลดข้อมูลการวิเคราะห์...</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Settings Content */}
                            {activeComponent === "settings" && (
                                <div>
                                    <div className="component-content">
                                        <h2>⚙️ Settings</h2>
                                        <div className="settings-section">
                                            <h3>System Information</h3>
                                            <p>TaskFlow Pro - Classic UI</p>
                                            <p>Backend: PostgreSQL Integration</p>
                                            <p>Data Source: Real ClickUp API</p>
                                            <p>Version: v13.1.0-classic-ui-compatible</p>
                                        </div>
                                        <div className="settings-section" style={{marginTop: '20px'}}>
                                            <h3>API Endpoints</h3>
                                            <p>• Team Overview: /api/v2/team/overview</p>
                                            <p>• My Tasks: /api/v2/tasks/my-tasks</p>
                                            <p>• Projects: /api/v2/projects</p>
                                            <p>• Analytics: /api/v2/dashboard/analytics</p>
                                        </div>
                                    </div>
                                </div>
                            )}