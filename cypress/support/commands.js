// cypress/support/commands.js
Cypress.Commands.add('login', (username = 'testuser', password = 'password123') => {
  cy.session([username, password], () => {
    // This would typically involve cy.request to your login API
    // and then validating the response and setting cookies/localStorage.
    // For now, we'll just visit the base page and assume a logged-in state for E2E.
    // We will rely on cy.intercept for API calls within tests.
    cy.visit('/'); // Or a specific dashboard page if login redirects there
    // You might set a cookie or local storage item here to simulate session
    // window.localStorage.setItem('isLoggedIn', 'true');
    // cy.setCookie('app_session', 'dummy_session_token');
    cy.log('Logged in (simulated)');
  });
  cy.visit('/'); // Visit the page after session setup
});
