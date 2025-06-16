// cypress/e2e/logout.cy.js

// Placeholder for a custom login command

describe('Logout E2E Test', () => {
  beforeEach(() => {
    cy.login(); // Perform login
    cy.visit('/'); // Ensure we are on a page that has the logout button (e.g., main page after login)
  });

  it('successfully logs out the user and redirects to login page', () => {
    // Intercept the logout API call
    cy.intercept('POST', '/api/auth/logout', (req) => {
      // No specific body check needed unless the API expects one for logout
      req.reply({
        statusCode: 200,
        body: { message: 'Successfully logged out and session cleared.' },
      });
    }).as('logoutApi');

    // Assume a logout button exists, e.g., in a navbar or user menu
    cy.get('[data-cy="logout-button"]').click();

    cy.wait('@logoutApi');

    // Verify redirection to the login page
    cy.url().should('include', '/login'); // Or '/' if your login page is the root

    // Verify UI elements indicating a logged-out state
    cy.get('[data-cy="login-form"]').should('be.visible'); // Assuming a login form is now visible
    cy.get('[data-cy="logout-button"]').should('not.exist'); // Logout button should be gone

    // Optional: Verify that accessing a protected route redirects to login
    cy.visit('/dashboard'); // Or any protected route
    cy.url().should('include', '/login'); // Should be redirected back to login
  });

  it('handles logout API failure gracefully (e.g., user stays on page with error message)', () => {
    // Intercept the logout API call to simulate a server error
    cy.intercept('POST', '/api/auth/logout', {
      statusCode: 500,
      body: { error: 'Logout failed on server.' },
    }).as('logoutApiError');

    cy.get('[data-cy="logout-button"]').click();

    cy.wait('@logoutApiError');

    // Assert that the user is NOT redirected to the login page
    cy.url().should('not.include', '/login');
    // Assert that an error message is shown to the user (if applicable)
    cy.contains('Logout failed. Please try again.').should('be.visible'); // Example error message
     // Logout button should still exist
    cy.get('[data-cy="logout-button"]').should('be.visible');
  });
});
