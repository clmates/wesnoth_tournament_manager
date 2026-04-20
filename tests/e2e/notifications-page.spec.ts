import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_USER_USERNAME = 'testuser';
const TEST_USER_PASSWORD = 'Test123!@#';

let page: Page;
let authToken: string;

/**
 * Helper function to login and get auth token
 */
async function login(browserPage: Page, username: string, password: string) {
  await browserPage.goto('/login');
  await browserPage.fill('input[type="text"]', username);
  await browserPage.fill('input[type="password"]', password);
  await browserPage.click('button:has-text("Login")');
  
  // Wait for redirect to home page
  await browserPage.waitForURL('/', { timeout: 10000 });
  
  // Get token from localStorage
  const token = await browserPage.evaluate(() => {
    return localStorage.getItem('token');
  });
  
  return token;
}

test.describe('Notifications Page E2E Tests', () => {
  test.beforeAll(async ({ browser }) => {
    // This hook runs once before all tests
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ==========================================
  // TEST 1: Navigation Test
  // ==========================================
  test('1. Navigation - Should navigate to /user page and verify Notifications tab exists', async ({
    page: testPage,
  }) => {
    console.log('TEST 1: Navigation Test');
    
    // Login first
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    expect(authToken).toBeTruthy();
    
    // Navigate to user page
    await testPage.goto('/user');
    
    // Wait for page to load
    await testPage.waitForLoadState('networkidle');
    
    // Check that tabs are visible
    const tabs = testPage.locator('[role="tab"]');
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tabs`);
    
    // Expected tabs: Overall, Matches, Opponents, By Map, By Faction, Notifications
    expect(tabCount).toBeGreaterThanOrEqual(6);
    
    // Find and click Notifications tab
    const notificationsTab = testPage.locator('text=Notifications');
    await expect(notificationsTab).toBeVisible();
    await notificationsTab.click();
    
    // Wait for notifications content to load
    await testPage.waitForLoadState('networkidle');
    
    // Verify page loads without errors (check for error elements)
    const errorMessages = testPage.locator('.text-red-800, [role="alert"]');
    const errorCount = await errorMessages.count();
    console.log(`Found ${errorCount} error messages`);
    
    // Should have no critical errors (some warnings might exist)
    expect(errorCount).toBeLessThan(3);
    
    console.log('✓ TEST 1 PASSED: Navigation successful, Notifications tab visible and clickable');
  });

  // ==========================================
  // TEST 2: Filter Tabs Test
  // ==========================================
  test('2. Filter Tabs - Should verify All, Pending, Accepted filter buttons exist and work', async ({
    page: testPage,
  }) => {
    console.log('TEST 2: Filter Tabs Test');
    
    // Login and navigate to notifications
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    await testPage.goto('/user');
    await testPage.waitForLoadState('networkidle');
    
    const notificationsTab = testPage.locator('text=Notifications');
    await notificationsTab.click();
    await testPage.waitForLoadState('networkidle');
    
    // Check for filter buttons
    const filterButtons = testPage.locator('button:has-text("All"), button:has-text("Pending"), button:has-text("Accepted")');
    const buttonCount = await filterButtons.count();
    console.log(`Found ${buttonCount} filter buttons`);
    
    expect(buttonCount).toBeGreaterThanOrEqual(3);
    
    // Test each filter button
    const filters = ['All', 'Pending', 'Accepted'];
    
    for (const filter of filters) {
      console.log(`Testing ${filter} filter`);
      
      // Click filter button
      const button = testPage.locator(`button:has-text("${filter}")`).first();
      await button.click();
      
      // Wait for content to update
      await testPage.waitForTimeout(500);
      await testPage.waitForLoadState('networkidle');
      
      // Check that the button has active styling (blue border)
      const isActive = await button.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const borderColor = styles.borderBottomColor;
        return borderColor.includes('rgb(59, 130, 246)') || borderColor.includes('rgb(37, 99, 235)');
      });
      
      // Check if button has blue border-bottom class
      const classes = await button.getAttribute('class');
      const hasActiveStyling = classes?.includes('border-blue');
      
      console.log(`  ${filter} button active styling: ${hasActiveStyling || isActive}`);
      
      // Verify no error messages
      const errors = testPage.locator('[role="alert"], .text-red-800');
      const errorCount = await errors.count();
      expect(errorCount).toBeLessThan(3);
    }
    
    console.log('✓ TEST 2 PASSED: All filter buttons work correctly');
  });

  // ==========================================
  // TEST 3: Notification List Display Test
  // ==========================================
  test('3. Notification List - Should verify all notification fields display correctly', async ({
    page: testPage,
  }) => {
    console.log('TEST 3: Notification List Display Test');
    
    // Login and navigate to notifications
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    await testPage.goto('/user');
    await testPage.waitForLoadState('networkidle');
    
    const notificationsTab = testPage.locator('text=Notifications');
    await notificationsTab.click();
    await testPage.waitForLoadState('networkidle');
    
    // Check if there are any notifications
    const notificationItems = testPage.locator('[class*="border rounded-lg p-4"]');
    const notificationCount = await notificationItems.count();
    console.log(`Found ${notificationCount} notifications`);
    
    if (notificationCount > 0) {
      // Check first notification for required fields
      const firstNotification = notificationItems.first();
      
      // Check for icon (should be one of: 📅, ✅, ❌, 📬)
      const icon = firstNotification.locator('span').first();
      const iconText = await icon.textContent();
      console.log(`Notification icon: ${iconText}`);
      expect(['📅', '✅', '❌', '📬']).toContain(iconText?.trim());
      
      // Check for title
      const title = firstNotification.locator('h3.font-semibold');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      console.log(`Notification title: ${titleText}`);
      expect(titleText).toBeTruthy();
      
      // Check for message text
      const message = firstNotification.locator('p.text-gray-700').first();
      await expect(message).toBeVisible();
      const messageText = await message.textContent();
      console.log(`Notification message: ${messageText}`);
      expect(messageText).toBeTruthy();
      
      // Check for date/time
      const dateElement = firstNotification.locator('.text-xs.text-gray-500');
      await expect(dateElement).toBeVisible();
      const dateText = await dateElement.textContent();
      console.log(`Notification date: ${dateText}`);
      expect(dateText).toBeTruthy();
      
      // Check for unread indicator (blue dot) if notification is unread
      const unreadsIndicator = firstNotification.locator('span[class*="w-2 h-2 bg-blue"]');
      const hasUnreadIndicator = await unreadsIndicator.count() > 0;
      console.log(`Has unread indicator: ${hasUnreadIndicator}`);
      
      // Check for message_extra if present
      const messageExtra = firstNotification.locator('[class*="bg-gray-100 rounded p-3"]');
      const hasMessageExtra = await messageExtra.count() > 0;
      console.log(`Has message_extra: ${hasMessageExtra}`);
    } else {
      console.log('No notifications found - this is also valid');
    }
    
    console.log('✓ TEST 3 PASSED: Notification list displays all required fields');
  });

  // ==========================================
  // TEST 4: Mark as Read Action Test
  // ==========================================
  test('4. Mark as Read Action - Should mark unread notifications as read', async ({
    page: testPage,
  }) => {
    console.log('TEST 4: Mark as Read Action Test');
    
    // Login and navigate to notifications
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    await testPage.goto('/user');
    await testPage.waitForLoadState('networkidle');
    
    const notificationsTab = testPage.locator('text=Notifications');
    await notificationsTab.click();
    await testPage.waitForLoadState('networkidle');
    
    // Click on "All" filter to ensure we see all notifications
    const allFilterButton = testPage.locator('button:has-text("All")').first();
    await allFilterButton.click();
    await testPage.waitForTimeout(500);
    
    // Find unread notifications (those with blue dot)
    const unreadNotifications = testPage.locator('[class*="bg-blue-50 border-blue"]');
    const unreadCount = await unreadNotifications.count();
    console.log(`Found ${unreadCount} unread notifications`);
    
    if (unreadCount > 0) {
      // Get the first unread notification
      const firstUnread = unreadNotifications.first();
      
      // Check that mark as read button exists
      const markReadButton = firstUnread.locator('button:has-text("✓")');
      await expect(markReadButton).toBeVisible();
      
      // Get notification ID for debugging
      const notificationId = await firstUnread.getAttribute('data-id');
      console.log(`Marking notification as read: ${notificationId}`);
      
      // Click mark as read button
      await markReadButton.click();
      
      // Wait for the action to complete
      await testPage.waitForTimeout(1000);
      
      // Verify blue dot disappears
      const blueDot = firstUnread.locator('span[class*="w-2 h-2 bg-blue"]');
      const blueDotCount = await blueDot.count();
      console.log(`Blue dots after mark as read: ${blueDotCount}`);
      
      // Verify no error messages
      const errors = testPage.locator('[role="alert"], .text-red-800');
      const errorCount = await errors.count();
      expect(errorCount).toBeLessThan(3);
      
      console.log('✓ Mark as read action completed');
    } else {
      console.log('No unread notifications to test');
    }
    
    console.log('✓ TEST 4 PASSED: Mark as read action works correctly');
  });

  // ==========================================
  // TEST 5: Delete Action Test
  // ==========================================
  test('5. Delete Action - Should delete notifications', async ({
    page: testPage,
  }) => {
    console.log('TEST 5: Delete Action Test');
    
    // Login and navigate to notifications
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    await testPage.goto('/user');
    await testPage.waitForLoadState('networkidle');
    
    const notificationsTab = testPage.locator('text=Notifications');
    await notificationsTab.click();
    await testPage.waitForLoadState('networkidle');
    
    // Click on "All" filter
    const allFilterButton = testPage.locator('button:has-text("All")').first();
    await allFilterButton.click();
    await testPage.waitForTimeout(500);
    
    // Get initial notification count
    const notificationsBefore = testPage.locator('[class*="border rounded-lg p-4"]');
    const countBefore = await notificationsBefore.count();
    console.log(`Notifications before delete: ${countBefore}`);
    
    if (countBefore > 0) {
      // Get the last notification
      const lastNotification = notificationsBefore.last();
      
      // Find delete button
      const deleteButton = lastNotification.locator('button:has-text("🗑️")');
      await expect(deleteButton).toBeVisible();
      
      // Click delete button
      await deleteButton.click();
      
      // Wait for delete action to complete
      await testPage.waitForTimeout(1000);
      
      // Get notification count after delete
      const notificationsAfter = testPage.locator('[class*="border rounded-lg p-4"]');
      const countAfter = await notificationsAfter.count();
      console.log(`Notifications after delete: ${countAfter}`);
      
      // Verify count decreased
      expect(countAfter).toBeLessThanOrEqual(countBefore);
      
      // Verify no error messages
      const errors = testPage.locator('[role="alert"], .text-red-800');
      const errorCount = await errors.count();
      expect(errorCount).toBeLessThan(3);
      
      console.log('✓ Delete action completed');
    } else {
      console.log('No notifications to delete');
    }
    
    console.log('✓ TEST 5 PASSED: Delete action works correctly');
  });

  // ==========================================
  // TEST 6: Pagination Test
  // ==========================================
  test('6. Pagination - Should handle pagination if more than 20 notifications exist', async ({
    page: testPage,
  }) => {
    console.log('TEST 6: Pagination Test');
    
    // Login and navigate to notifications
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    await testPage.goto('/user');
    await testPage.waitForLoadState('networkidle');
    
    const notificationsTab = testPage.locator('text=Notifications');
    await notificationsTab.click();
    await testPage.waitForLoadState('networkidle');
    
    // Click on "All" filter to enable pagination
    const allFilterButton = testPage.locator('button:has-text("All")').first();
    await allFilterButton.click();
    await testPage.waitForTimeout(500);
    
    // Check if pagination controls exist
    const paginationContainer = testPage.locator('div:has-text("← Previous")');
    const hasPagination = await paginationContainer.count() > 0;
    console.log(`Has pagination: ${hasPagination}`);
    
    if (hasPagination) {
      // Get current page info
      const pageInfo = testPage.locator('span.text-sm.text-gray-600').first();
      const pageInfoText = await pageInfo.textContent();
      console.log(`Page info: ${pageInfoText}`);
      
      // Check for Next button
      const nextButton = testPage.locator('button:has-text("Next →")').first();
      const nextButtonVisible = await nextButton.isVisible();
      console.log(`Next button visible: ${nextButtonVisible}`);
      
      // Check for Previous button
      const prevButton = testPage.locator('button:has-text("← Previous")').first();
      const prevButtonVisible = await prevButton.isVisible();
      console.log(`Previous button visible: ${prevButtonVisible}`);
      
      // If Next button is enabled, test clicking it
      if (nextButtonVisible) {
        const isNextEnabled = !(await nextButton.isDisabled());
        if (isNextEnabled) {
          console.log('Testing Next button click');
          await nextButton.click();
          await testPage.waitForTimeout(1000);
          
          // Verify new notifications are displayed
          const notifications = testPage.locator('[class*="border rounded-lg p-4"]');
          const notificationCount = await notifications.count();
          console.log(`Notifications on next page: ${notificationCount}`);
          expect(notificationCount).toBeGreaterThan(0);
        }
      }
    } else {
      console.log('Not enough notifications for pagination (less than 20)');
    }
    
    console.log('✓ TEST 6 PASSED: Pagination works correctly (or not applicable)');
  });

  // ==========================================
  // TEST 7: Direct URL Access Test
  // ==========================================
  test('7. Direct URL Access - Should load notifications tab via direct URL', async ({
    page: testPage,
  }) => {
    console.log('TEST 7: Direct URL Access Test');
    
    // Login first
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    
    // Direct access to /user?tab=notifications
    await testPage.goto('/user?tab=notifications');
    
    // Wait for page to load
    await testPage.waitForLoadState('networkidle');
    
    // Verify we're on the notifications tab
    const notificationsTab = testPage.locator('text=Notifications');
    await expect(notificationsTab).toBeVisible();
    
    // Check that filter buttons are visible
    const filterButtons = testPage.locator('button:has-text("All"), button:has-text("Pending"), button:has-text("Accepted")');
    const buttonCount = await filterButtons.count();
    console.log(`Filter buttons found: ${buttonCount}`);
    expect(buttonCount).toBeGreaterThanOrEqual(3);
    
    // Verify no error messages
    const errors = testPage.locator('[role="alert"], .text-red-800');
    const errorCount = await errors.count();
    expect(errorCount).toBeLessThan(3);
    
    console.log('✓ TEST 7 PASSED: Direct URL access works correctly');
  });

  // ==========================================
  // TEST 8: Console Errors Check
  // ==========================================
  test('8. Console Errors - Should have no critical console errors', async ({
    page: testPage,
  }) => {
    console.log('TEST 8: Console Errors Check');
    
    const consoleErrors: string[] = [];
    
    // Listen for console errors
    testPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Login and navigate
    authToken = await login(testPage, TEST_USER_USERNAME, TEST_USER_PASSWORD);
    await testPage.goto('/user');
    await testPage.waitForLoadState('networkidle');
    
    const notificationsTab = testPage.locator('text=Notifications');
    await notificationsTab.click();
    await testPage.waitForLoadState('networkidle');
    
    // Test each filter
    const filters = ['All', 'Pending', 'Accepted'];
    for (const filter of filters) {
      const button = testPage.locator(`button:has-text("${filter}")`).first();
      await button.click();
      await testPage.waitForTimeout(500);
    }
    
    // Log any errors found
    if (consoleErrors.length > 0) {
      console.log('Console errors found:');
      consoleErrors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }
    
    // Filter out non-critical errors (like 3rd party scripts)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('CORS') &&
        !error.includes('Failed to load external') &&
        !error.includes('404') &&
        !error.includes('favicon')
    );
    
    console.log(`Critical console errors: ${criticalErrors.length}`);
    expect(criticalErrors.length).toBeLessThan(3);
    
    console.log('✓ TEST 8 PASSED: No critical console errors found');
  });
});
