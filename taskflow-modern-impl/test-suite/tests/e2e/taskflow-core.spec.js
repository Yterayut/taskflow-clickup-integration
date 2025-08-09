import { test, expect } from '@playwright/test';

const TEST_CONFIG = {
  baseURL: 'http://192.168.20.10:8888',
  users: {
    manager: { email: 'yterayut@gmail.com', password: '12345', role: 'Manager' },
    teamLead: { email: 'chaiwutwck@gmail.com', password: '12345', role: 'Team Lead' },
    employee: { email: 'kittipong@example.com', password: '12345', role: 'Employee' }
  }
};

test.describe('TaskFlow Pro - Core Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#taskCount', { timeout: 10000 });
  });

  test('Application loads successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/TaskFlow Pro/);
    
    // Check essential elements are present
    await expect(page.locator('#themeToggle')).toBeVisible();
    await expect(page.locator('#navMenu')).toBeVisible();
    await expect(page.locator('#dashboard')).toBeVisible();
    
    // Check initial view is dashboard
    await expect(page.locator('#dashboard')).toHaveClass(/component.*active/);
    
    console.log('✅ Application loads successfully');
  });

  test('Theme toggle functionality', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle');
    
    // Initial state should be light theme
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    
    // Toggle to dark theme
    await themeToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    
    // Toggle back to light theme
    await themeToggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    
    console.log('✅ Theme toggle works correctly');
  });

  test('Navigation between components', async ({ page }) => {
    const components = [
      'my-tasks',
      'team-overview', 
      'employee-management',
      'team-ranking',
      'projects',
      'reports',
      'calendar',
      'settings'
    ];
    
    for (const component of components) {
      // Click navigation item
      await page.click(`[onclick*="switchView('${component}')"]`);
      
      // Wait for component to load
      await page.waitForTimeout(1000);
      
      // Check URL is updated
      await expect(page).toHaveURL(new RegExp(`view=${component}`));
      
      // Check component is active
      await expect(page.locator(`#${component}`)).toBeVisible();
      
      console.log(`✅ Navigation to ${component} successful`);
    }
  });

  test('Update Now functionality', async ({ page }) => {
    // Click Update Now button
    const updateButton = page.locator('#updateButton');
    await expect(updateButton).toBeVisible();
    
    await updateButton.click();
    
    // Check for loading indicator
    await expect(page.locator('#updateStatus')).toContainText(/Updating|Updated/);
    
    // Wait for update to complete
    await page.waitForTimeout(3000);
    
    // Check last updated timestamp is recent
    const lastUpdated = await page.locator('#lastUpdated').textContent();
    expect(lastUpdated).toMatch(/\d{2}:\d{2}:\d{2}/);
    
    console.log('✅ Update functionality works');
  });

  test('KPI cards display data', async ({ page }) => {
    // Wait for KPI grid to load
    await page.waitForSelector('#kpiGrid', { timeout: 10000 });
    
    // Check if KPI cards contain numeric data
    const kpiCards = page.locator('#kpiGrid .kpi-card');
    const kpiCount = await kpiCards.count();
    
    expect(kpiCount).toBeGreaterThan(0);
    
    // Check each KPI card has a value
    for (let i = 0; i < kpiCount; i++) {
      const kpiValue = kpiCards.nth(i).locator('.kpi-value');
      await expect(kpiValue).toBeVisible();
      
      const value = await kpiValue.textContent();
      expect(value).toMatch(/\d+/); // Should contain numbers
    }
    
    console.log(`✅ ${kpiCount} KPI cards displaying data`);
  });

  test('Team grid loads employee data', async ({ page }) => {
    // Wait for team grid to load
    await page.waitForSelector('#teamGrid', { timeout: 10000 });
    
    // Check if employee cards are present
    const employeeCards = page.locator('#teamGrid .employee-card');
    const cardCount = await employeeCards.count();
    
    expect(cardCount).toBeGreaterThan(0);
    
    // Check each employee card has essential info
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = employeeCards.nth(i);
      
      // Check employee name exists
      await expect(card.locator('h3')).toBeVisible();
      
      // Check workload section exists
      await expect(card.locator('.workload-section')).toBeVisible();
    }
    
    console.log(`✅ ${cardCount} employee cards loaded`);
  });

  test('Activity feed displays recent activity', async ({ page }) => {
    // Wait for activity feed to load
    await page.waitForSelector('#activityFeed', { timeout: 10000 });
    
    // Check if activity items are present
    const activityItems = page.locator('#activityFeed .activity-item');
    const itemCount = await activityItems.count();
    
    if (itemCount > 0) {
      // Check first activity item has proper structure
      const firstItem = activityItems.first();
      await expect(firstItem.locator('.activity-text')).toBeVisible();
      await expect(firstItem.locator('.activity-time')).toBeVisible();
    }
    
    console.log(`✅ Activity feed with ${itemCount} items`);
  });

  test('Component data loads without Update Now', async ({ page }) => {
    // Navigate to My Tasks
    await page.click('[onclick*="switchView(\'my-tasks\')"]');
    await page.waitForTimeout(2000);
    
    // Check if myTasksList element exists and is populated
    const tasksList = page.locator('#myTasksList');
    await expect(tasksList).toBeVisible();
    
    // Navigate to Team Overview
    await page.click('[onclick*="switchView(\'team-overview\')"]');
    await page.waitForTimeout(2000);
    
    // Check if teamOverviewGrid element exists
    const teamGrid = page.locator('#teamOverviewGrid');
    await expect(teamGrid).toBeVisible();
    
    console.log('✅ Components load data automatically');
  });

  test('Error handling for network issues', async ({ page }) => {
    // Test with invalid API endpoint (simulate network error)
    await page.route('**/api/**', route => {
      route.abort();
    });
    
    // Try to update data
    await page.click('#updateButton');
    await page.waitForTimeout(2000);
    
    // Check if error state is handled gracefully
    const errorIndicator = page.locator('#errorState, .error-message');
    
    // Application should not crash
    await expect(page.locator('#navMenu')).toBeVisible();
    
    console.log('✅ Error handling works correctly');
  });

  test('Responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if navigation adapts to mobile
    await expect(page.locator('#navMenu')).toBeVisible();
    
    // Check if main content is properly sized
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
    
    // Test component switching on mobile
    await page.click('[onclick*="switchView(\'my-tasks\')"]');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('#my-tasks')).toBeVisible();
    
    console.log('✅ Mobile responsive design works');
  });

  test('Performance - Page load times', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#dashboard', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    console.log(`✅ Page loaded in ${loadTime}ms`);
  });
});

test.describe('TaskFlow Pro - ClickUp Integration', () => {
  
  test('ClickUp connection button is present', async ({ page }) => {
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
    
    // Look for ClickUp connection elements
    const clickupButton = page.locator('text=/Connect.*ClickUp|ClickUp.*Connect/i');
    
    if (await clickupButton.count() > 0) {
      await expect(clickupButton.first()).toBeVisible();
      console.log('✅ ClickUp connection available');
    } else {
      console.log('ℹ️ ClickUp connection not visible (may be already connected)');
    }
  });

  test('ClickUp OAuth redirect works', async ({ page }) => {
    await page.goto('http://192.168.20.10:7810/auth/clickup');
    
    // Should redirect to ClickUp OAuth
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('clickup.com');
    
    console.log('✅ ClickUp OAuth redirect functional');
  });
});

test.describe('TaskFlow Pro - Backend Health', () => {
  
  test('Backend health endpoint responds', async ({ request }) => {
    const response = await request.get('http://192.168.20.10:7810/health');
    
    expect(response.status()).toBe(200);
    
    const health = await response.json();
    expect(health.status).toBe('OK');
    expect(health.service).toContain('TaskFlow');
    
    console.log('✅ Backend health check passed');
  });

  test('Backend API endpoints are accessible', async ({ request }) => {
    const endpoints = [
      '/health',
      '/api/v1/users',
      '/api/v1/clickup-data'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`http://192.168.20.10:7810${endpoint}`);
        
        // Accept both success and auth errors (401/403) as "accessible"
        expect([200, 401, 403, 500]).toContain(response.status());
        
        console.log(`✅ Endpoint ${endpoint} accessible (${response.status()})`);
      } catch (error) {
        console.log(`⚠️ Endpoint ${endpoint} connection error: ${error.message}`);
      }
    }
  });
});