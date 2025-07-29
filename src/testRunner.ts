import { runTests } from './apiTest';

// Run all tests
(async () => {
  try {
    console.log('Starting API tests...');
    await runTests();
    console.log('All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();