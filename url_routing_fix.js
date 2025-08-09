        // Enhanced switchView with URL routing
        function switchView(viewId, event) {
            console.log(`Switching to view: ${viewId}`);
            
            // Hide all components
            document.querySelectorAll('.component').forEach(comp => {
                comp.classList.remove('active');
            });
            
            // Show selected component
            const targetComponent = document.getElementById(viewId);
            if (targetComponent) {
                targetComponent.classList.add('active');
                currentView = viewId;
                
                // Update URL based on component
                const urlPath = getUrlPath(viewId);
                window.history.pushState({ view: viewId }, '', urlPath);
                
                // Update navigation active state
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                
                // Find and activate the clicked navigation link
                if (event && event.target) {
                    const clickedLink = event.target.closest('.nav-link');
                    if (clickedLink) {
                        clickedLink.classList.add('active');
                    }
                } else {
                    // Fallback: find the link by viewId
                    const navLinks = document.querySelectorAll('.nav-link');
                    navLinks.forEach(link => {
                        const onclick = link.getAttribute('onclick');
                        if (onclick && onclick.includes(viewId)) {
                            link.classList.add('active');
                        }
                    });
                }
                
                // Load component specific data immediately
                loadComponentDataImmediate(viewId);
            }
        }

        // Get URL path for component
        function getUrlPath(viewId) {
            const pathMap = {
                'dashboard': '/',
                'my-tasks': '/my-tasks',
                'team-overview': '/team-overview',
                'employee-management': '/employee-management',
                'team-ranking': '/team-ranking',
                'projects': '/projects',
                'reports': '/reports',
                'calendar': '/calendar',
                'settings': '/settings'
            };
            return pathMap[viewId] || '/';
        }

        // Get viewId from URL path
        function getViewFromPath(path) {
            const viewMap = {
                '/': 'dashboard',
                '/my-tasks': 'my-tasks',
                '/team-overview': 'team-overview',
                '/employee-management': 'employee-management',
                '/team-ranking': 'team-ranking',
                '/projects': 'projects',
                '/reports': 'reports',
                '/calendar': 'calendar',
                '/settings': 'settings'
            };
            return viewMap[path] || 'dashboard';
        }

        // Handle browser back/forward buttons
        window.addEventListener('popstate', function(event) {
            console.log('Browser navigation detected');
            const viewId = event.state ? event.state.view : getViewFromPath(window.location.pathname);
            
            // Switch to the view without adding to history (to prevent infinite loop)
            currentView = viewId;
            
            // Hide all components
            document.querySelectorAll('.component').forEach(comp => {
                comp.classList.remove('active');
            });
            
            // Show target component
            const targetComponent = document.getElementById(viewId);
            if (targetComponent) {
                targetComponent.classList.add('active');
                
                // Update navigation
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                
                const navLinks = document.querySelectorAll('.nav-link');
                navLinks.forEach(link => {
                    const onclick = link.getAttribute('onclick');
                    if (onclick && onclick.includes(viewId)) {
                        link.classList.add('active');
                    }
                });
                
                // Load component data
                loadComponentDataImmediate(viewId);
            }
        });

        // Initialize URL routing on page load
        function initializeRouting() {
            const currentPath = window.location.pathname;
            const viewId = getViewFromPath(currentPath);
            
            if (viewId !== 'dashboard') {
                // If URL has a specific component, switch to it
                setTimeout(() => {
                    switchView(viewId);
                }, 100);
            }
        }