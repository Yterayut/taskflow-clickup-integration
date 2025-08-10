            // Load component-specific data
            const loadComponentData = async (component) => {
                console.log(`Loading data for component: ${component}`);
                
                switch(component) {
                    case "team":
                        try {
                            const response = await fetch("http://192.168.20.10:7812/api/v2/team/overview");
                            if (response.ok) {
                                const data = await response.json();
                                setComponentData(data);
                                console.log("Team data loaded:", data);
                            }
                        } catch (error) {
                            console.error("Failed to load team data:", error);
                        }
                        break;
                    case "tasks":
                        try {
                            const response = await fetch("http://192.168.20.10:7812/api/v2/tasks/my-tasks");
                            if (response.ok) {
                                const data = await response.json();
                                setComponentData(data);
                                console.log("Tasks data loaded:", data);
                            }
                        } catch (error) {
                            console.error("Failed to load tasks data:", error);
                        }
                        break;
                    case "projects":
                        try {
                            const response = await fetch("http://192.168.20.10:7812/api/v2/projects");
                            if (response.ok) {
                                const data = await response.json();
                                setComponentData(data);
                                console.log("Projects data loaded:", data);
                            }
                        } catch (error) {
                            console.error("Failed to load projects data:", error);
                        }
                        break;
                    default:
                        setComponentData(null);
                }
            };