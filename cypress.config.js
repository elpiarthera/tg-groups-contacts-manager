const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000', // Default Next.js dev server URL
    setupNodeEvents(on, config) {
      // implement node event listeners here
      // For example, if you need to log messages from Cypress to the terminal:
      // on('task', {
      //   log(message) {
      //     console.log(message);
      //     return null;
      //   },
      // });
    },
    supportFile: false, // Set to 'cypress/support/e2e.js' if you add custom commands/support.
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}', // Default spec pattern
  },
  // Component testing can be configured here as well if needed in the future
  // component: {
  //   devServer: {
  //     framework: 'next',
  //     bundler: 'webpack',
  //   },
  // },
});
