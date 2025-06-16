// cypress/e2e/extract_contacts.cy.js

// Placeholder for a custom login command (assuming it's defined in support/commands.js)
// Cypress.Commands.add('login', () => { ... });

describe('Contact Extraction E2E Tests', () => {
  beforeEach(() => {
    cy.login(); // Assumes login and navigation to a relevant starting page
    // cy.visit('/contacts-dashboard'); // Or similar if needed
  });

  it('successfully extracts and displays contacts', () => {
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.action === 'extractContacts') {
        req.reply({
          statusCode: 200,
          body: { message: 'Contacts extracted successfully.', count: 2 },
        });
      }
    }).as('extractContactsApi');

    // Intercept the call that fetches the list of contacts for display
    cy.intercept('GET', '/api/contacts', { // Assuming a GET endpoint like /api/contacts
      statusCode: 200,
      body: [
        { id: 'c1', telegram_id: 'tc1', first_name: 'John', last_name: 'Doe', phone: '123456789' },
        { id: 'c2', telegram_id: 'tc2', first_name: 'Jane', last_name: 'Smith', phone: '987654321' },
      ],
    }).as('getContactsList');

    // cy.get('[data-cy="nav-contacts"]').click(); // If navigation is needed
    cy.get('[data-cy="extract-contacts-button"]').click();

    cy.wait('@extractContactsApi');
    // cy.url().should('include', '/contacts-list'); // If navigation occurs
    cy.wait('@getContactsList');

    cy.contains('John Doe').should('be.visible');
    cy.contains('Jane Smith').should('be.visible');
    cy.get('table tbody tr').should('have.length', 2);
    cy.contains('123456789').should('be.visible');
  });

  it('handles no contacts found', () => {
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.action === 'extractContacts') {
        req.reply({
          statusCode: 200,
          body: { message: 'No contacts found or extracted.', count: 0 },
        });
      }
    }).as('extractContactsApiEmpty');

    cy.intercept('GET', '/api/contacts', {
      statusCode: 200,
      body: [], // No contacts
    }).as('getContactsListEmpty');

    // cy.visit('/contacts-dashboard'); // Or relevant page
    cy.get('[data-cy="extract-contacts-button"]').click();

    cy.wait('@extractContactsApiEmpty');
    // cy.url().should('include', '/contacts-list');
    cy.wait('@getContactsListEmpty');

    cy.get('table tbody tr').should('not.exist'); // Or have.length 0
    cy.contains('No contacts found').should('be.visible');
  });
});
