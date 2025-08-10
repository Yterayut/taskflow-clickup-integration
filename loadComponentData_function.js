            // Load component-specific data from APIs
            const loadComponentData = async (component) => {
                console.log(`🔄 Loading data for component: ${component}`);
                setComponentData(null); // Clear previous data while loading
                
                try {
                    switch(component) {
                        case "team":
                            console.log("📡 Fetching team data from /api/v2/team/overview");
                            const teamResponse = await fetch("http://192.168.20.10:7812/api/v2/team/overview");
                            if (teamResponse.ok) {
                                const teamData = await teamResponse.json();
                                console.log("✅ Team data loaded:", teamData);
                                setComponentData(teamData);
                            } else {
                                console.error("❌ Failed to fetch team data:", teamResponse.status);
                            }
                            break;
                            
                        case "tasks":
                            console.log("📡 Fetching tasks data from /api/v2/tasks/my-tasks");
                            const tasksResponse = await fetch("http://192.168.20.10:7812/api/v2/tasks/my-tasks");
                            if (tasksResponse.ok) {
                                const tasksData = await tasksResponse.json();
                                console.log("✅ Tasks data loaded:", tasksData);
                                setComponentData(tasksData);
                            } else {
                                console.error("❌ Failed to fetch tasks data:", tasksResponse.status);
                            }
                            break;
                            
                        case "projects":
                            console.log("📡 Fetching projects data from /api/v2/projects");
                            const projectsResponse = await fetch("http://192.168.20.10:7812/api/v2/projects");
                            if (projectsResponse.ok) {
                                const projectsData = await projectsResponse.json();
                                console.log("✅ Projects data loaded:", projectsData);
                                setComponentData(projectsData);
                            } else {
                                console.error("❌ Failed to fetch projects data:", projectsResponse.status);
                            }
                            break;
                            
                        case "analytics":
                            console.log("📡 Fetching analytics data from /api/v2/dashboard/analytics");
                            const analyticsResponse = await fetch("http://192.168.20.10:7812/api/v2/dashboard/analytics");
                            if (analyticsResponse.ok) {
                                const analyticsData = await analyticsResponse.json();
                                console.log("✅ Analytics data loaded:", analyticsData);
                                setComponentData(analyticsData);
                            } else {
                                console.error("❌ Failed to fetch analytics data:", analyticsResponse.status);
                            }
                            break;
                            
                        default:
                            // Dashboard or Settings - use existing data or null
                            console.log("📊 Using existing dashboard data or no additional data needed");
                            setComponentData(null);
                    }
                } catch (error) {
                    console.error(`❌ Error loading ${component} data:`, error);
                    setComponentData(null);
                }
            };