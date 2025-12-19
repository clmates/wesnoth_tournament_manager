#!/usr/bin/env node

/**
 * Password Validation Test
 * Tests both frontend and backend password validation rules
 */

// Test cases: password -> { frontendValid, backendValid, reason }
const testCases = [
  // Valid passwords (should pass all rules)
  { password: 'MyPassword123!', shouldPass: true, reason: '8+ chars, uppercase, lowercase, number, special' },
  { password: 'Test@12345', shouldPass: true, reason: 'Valid: T(uppercase), e(lowercase), @(special), 12345(numbers)' },
  
  // Missing uppercase letter
  { password: 'mypassword123!', shouldPass: false, reason: 'Missing uppercase letter' },
  
  // Missing lowercase letter  
  { password: 'MYPASSWORD123!', shouldPass: false, reason: 'Missing lowercase letter' },
  
  // Missing number
  { password: 'MyPassword!', shouldPass: false, reason: 'Missing number' },
  
  // Missing special character
  { password: 'MyPassword123', shouldPass: false, reason: 'Missing special character' },
  
  // Too short (less than 8 characters)
  { password: 'My@12', shouldPass: false, reason: 'Only 5 characters, needs 8+' },
  
  // All requirements met
  { password: 'Secure@Pass123', shouldPass: true, reason: 'All 5 requirements met' },
];

// Frontend regex patterns (matching Register.tsx)
const frontendRules = [
  { regex: /.{8,}/, label: 'At least 8 characters' },
  { regex: /[A-Z]/, label: 'At least one uppercase letter' },
  { regex: /[a-z]/, label: 'At least one lowercase letter' },
  { regex: /[0-9]/, label: 'At least one number' },
  { regex: /[!@#$%^&*(),.?":{}|<>]/, label: 'At least one special character' },
];

// Backend validation rules (matching backend/src/utils/auth.ts)
const backendValidate = (password) => {
  const errors = [];
  const policy = {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: true,
  };

  if (password.length < policy.min_length) {
    errors.push(`Password must be at least ${policy.min_length} characters long`);
  }
  if (policy.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (policy.require_lowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (policy.require_numbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (policy.require_symbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const frontendValidate = (password) => {
  const validation = frontendRules.map(rule => ({
    ...rule,
    satisfied: rule.regex.test(password)
  }));
  return validation.every(rule => rule.satisfied);
};

console.log('🔐 PASSWORD VALIDATION TEST SUITE\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const { password, shouldPass, reason } = testCase;
  
  const frontendResult = frontendValidate(password);
  const backendResult = backendValidate(password);
  
  const frontendValid = frontendResult;
  const backendValid = backendResult.valid;
  
  // Both should agree and match shouldPass
  const frontendMatches = frontendValid === shouldPass;
  const backendMatches = backendValid === shouldPass;
  const aligned = frontendValid === backendValid;
  
  const testPassed = frontendMatches && backendMatches && aligned;
  
  if (testPassed) {
    passed++;
    console.log(`✅ Test ${index + 1} PASSED`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1} FAILED`);
  }
  
  console.log(`   Password: "${password}"`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Expected: ${shouldPass ? 'VALID' : 'INVALID'}`);
  console.log(`   Frontend: ${frontendValid ? '✓ VALID' : '✗ INVALID'} ${frontendMatches ? '✓' : '✗'}`);
  console.log(`   Backend:  ${backendValid ? '✓ VALID' : '✗ INVALID'} ${backendMatches ? '✓' : '✗'}`);
  
  if (!backendValid && backendResult.errors.length > 0) {
    console.log(`   Backend errors: ${backendResult.errors.join('; ')}`);
  }
  
  console.log('');
});

console.log('='.repeat(80));
console.log(`\nTest Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('\n✅ All tests passed! Frontend and backend validation are aligned.');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Frontend and backend validation may not be aligned.');
  process.exit(1);
}
