// cypress/e2e/extract_groups.cy.js

// The cy.login() command is now defined in cypress/support/commands.js
// and imported via cypress/support/e2e.js

describe('Group Extraction E2E Tests', () => {
  beforeEach(() => {
    cy.login(); // Assumes login redirects to a page where extraction can be initiated or navigated to.
    // Adjust cy.visit('/') in login or here if needed.
    // e.g., cy.visit('/groups-dashboard'); if that's the starting point
  });

  it('successfully extracts and displays groups', () => {
    // Intercept the API call for extracting groups
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.action === 'extractGroups') {
        req.reply({
          statusCode: 200,
          body: {
            message: 'Groups extracted successfully.',
            count: 2,
            // Simulate that the actual data would be fetched by a subsequent call
            // or that the component redirects and then fetches.
            // For this test, we'll assume a redirect and then a fetch for group list.
          },
        });
      }
    }).as('extractGroupsApi');

    // Intercept the call that fetches the list of groups for display
    cy.intercept('GET', '/api/groups', { // Assuming a GET endpoint like /api/groups fetches the list
      statusCode: 200,
      body: [
        { id: 'g1', telegram_id: 'tg1', name: 'Test Group Alpha', type: 'group', member_count: 10, username: 'alphagroup' },
        { id: 'g2', telegram_id: 'tg2', name: 'Channel Beta', type: 'channel', member_count: 100, username: 'betachannel' },
      ],
    }).as('getGroupsList');

    // Navigate to the page if necessary, e.g., cy.visit('/groups-dashboard');
    // Or click a navigation item
    // cy.get('[data-cy="nav-groups"]').click();

    cy.get('[data-cy="extract-groups-button"]').click(); // Assuming a button with this data-cy attribute

    cy.wait('@extractGroupsApi'); // Wait for the extraction API call

    // Assuming extraction triggers navigation to a list page or updates current page
    // If it navigates: cy.url().should('include', '/groups-list');

    cy.wait('@getGroupsList'); // Wait for the list to be fetched

    cy.contains('Test Group Alpha').should('be.visible');
    cy.contains('Channel Beta').should('be.visible');
    cy.get('table tbody tr').should('have.length', 2);
    // cy.contains('Members: 10').should('be.visible'); // If member count is displayed like this
    // cy.contains('Members: 100').should('be.visible');
  });

  it('handles no groups found', () => {
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.action === 'extractGroups') {
        req.reply({
          statusCode: 200,
          body: { message: 'No groups found or extracted.', count: 0 },
        });
      }
    }).as('extractGroupsApiEmpty');

    cy.intercept('GET', '/api/groups', { // Assuming a GET endpoint
      statusCode: 200,
      body: [], // No groups
    }).as('getGroupsListEmpty');

    // cy.visit('/groups-dashboard'); // Or relevant page
    cy.get('[data-cy="extract-groups-button"]').click();

    cy.wait('@extractGroupsApiEmpty');
    // cy.url().should('include', '/groups-list'); // Or stay on same page
    cy.wait('@getGroupsListEmpty');

    cy.get('table tbody tr').should('not.exist'); // Or cy.get('table tbody tr').should('have.length', 0);
    cy.contains('No groups found').should('be.visible'); // Or similar message
  });
});
