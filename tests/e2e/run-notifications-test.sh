#!/bin/bash

# E2E Test Runner for Notifications Page
# This script runs E2E tests for the Notifications tab in the User profile page
# 
# REQUIREMENTS:
# - Frontend running on http://localhost:5173
# - Backend running on http://localhost:3000
# - User logged in with valid credentials
# 
# SETUP:
# 1. Start backend: cd backend && npm run dev
# 2. Start frontend: cd frontend && npm run dev
# 3. Run this test script: bash tests/e2e/run-notifications-test.sh

set -e

echo "🧪 Wesnoth Tournament Manager - Notifications Page E2E Tests"
echo "=============================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if servers are running
echo -e "${BLUE}ℹ️  Checking if development servers are running...${NC}"

# Check frontend
if ! nc -z localhost 5173 2>/dev/null; then
    echo -e "${RED}✗ Frontend not running on http://localhost:5173${NC}"
    echo -e "${YELLOW}  Please run: cd frontend && npm run dev${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Frontend running on http://localhost:5173${NC}"
fi

# Check backend
if ! nc -z localhost 3000 2>/dev/null; then
    echo -e "${RED}✗ Backend not running on http://localhost:3000${NC}"
    echo -e "${YELLOW}  Please run: cd backend && npm run dev${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Backend running on http://localhost:3000${NC}"
fi

echo ""
echo -e "${BLUE}ℹ️  Starting Playwright E2E tests...${NC}"
echo ""

# Run the Playwright tests
cd /home/carlos/programacion/wesnoth_tournament_manager

npx playwright test tests/e2e/notifications-page.spec.ts --reporter=html

echo ""
echo -e "${GREEN}✓ E2E tests completed!${NC}"
echo -e "${BLUE}📊 View test results: npx playwright show-report${NC}"
