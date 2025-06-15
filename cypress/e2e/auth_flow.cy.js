// cypress/e2e/auth_flow.cy.js

describe('Full Authentication Flow (API ID/Hash + Code)', () => {
  const testApiId = '1234567'; // Use a realistic-looking ID
  const testApiHash = 'dummyapihash1234567890abcdef1234';
  const testPhoneNumber = '+15551234560'; // Unique phone for this flow
  const validVerificationCode = '12345';
  const invalidVerificationCode = '54321';

  beforeEach(() => {
    // Intercept the checkSession call.
    // This intercept is specific to the 'checkSession' action.
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.action === 'checkSession') {
        // For these tests, assume no active session initially for the specific test phone number
        if (req.body.phoneNumber === testPhoneNumber) {
          req.reply({ statusCode: 200, body: { hasSession: false } });
        } else {
          // If it's a different number, or if you want a default for other numbers
          req.reply({ statusCode: 200, body: { hasSession: false } });
        }
      }
      // For other actions, this intercept won't match, allowing more specific intercepts in tests to handle them.
    }).as('checkSessionInitial'); // Give it a unique alias if it's general

    cy.visit('/');
    // It's good practice to wait for initial page elements to ensure the page is ready.
    cy.get('input[id="api-id"]').should('be.visible');
  });

  it('Scenario 1: Successfully authenticates with valid credentials and code', () => {
    // Mock for requesting code
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.phoneNumber === testPhoneNumber && !req.body.validationCode && !req.body.action) { // Ensure it's the code request
        req.reply({
          statusCode: 200,
          body: { success: true, requiresValidation: true, message: 'Validation code sent to your Telegram app.', phoneRegistered: true },
        });
      }
    }).as('requestCode');

    // Mock for verifying code
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.phoneNumber === testPhoneNumber && req.body.validationCode === validVerificationCode) {
        req.reply({
          statusCode: 200,
          body: { success: true, message: 'Authentication successful. You can now extract data.' },
        });
      }
    }).as('verifyCodeSuccess');

    cy.get('input[id="api-id"]').type(testApiId);
    cy.get('input[id="api-hash"]').type(testApiHash);
    cy.get('input[id="phone-number"]').type(testPhoneNumber);

    cy.contains('button', /Request Code/i).click();

    cy.wait('@requestCode');
    cy.contains(/Validation code sent/i).should('be.visible');
    cy.get('input[id="validation-code"]').should('be.visible');

    cy.get('input[id="validation-code"]').type(validVerificationCode);

    cy.contains('button', /Verify Code/i).click();
    cy.wait('@verifyCodeSuccess');

    cy.contains(/Authentication successful/i).should('be.visible');
    cy.contains('button', /Extract Data/i).should('be.enabled');
    cy.get('input[id="api-id"]').should('be.disabled');
    cy.get('input[id="api-hash"]').should('be.disabled');
    cy.get('input[id="phone-number"]').should('be.disabled');
    cy.get('input[id="validation-code"]').should('be.disabled'); // Assuming it gets disabled on success
    cy.contains('button', /Logout/i).should('be.visible');
  });

  it('Scenario 3: Shows client-side error for invalid phone number format', () => {
    cy.get('input[id="api-id"]').type(testApiId);
    cy.get('input[id="api-hash"]').type(testApiHash);
    cy.get('input[id="phone-number"]').type('123');

    cy.contains('button', /Request Code/i).click();

    cy.contains(/Please enter a valid phone number with country code/i).should('be.visible');
  });

  it('Scenario 4: Handles incorrect verification code', () => {
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.phoneNumber === testPhoneNumber && !req.body.validationCode && !req.body.action) {
        req.reply({
          statusCode: 200,
          body: { success: true, requiresValidation: true, message: 'Validation code sent', phoneRegistered: true },
        });
      }
    }).as('requestCodeForInvalidTest');

    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.phoneNumber === testPhoneNumber && req.body.validationCode === invalidVerificationCode) {
        req.reply({
          statusCode: 400,
          body: { success: false, message: 'Invalid validation code. Please try again.' }, // Ensure message matches component expectation
        });
      }
    }).as('verifyCodeFail');

    cy.get('input[id="api-id"]').type(testApiId);
    cy.get('input[id="api-hash"]').type(testApiHash);
    cy.get('input[id="phone-number"]').type(testPhoneNumber);
    cy.contains('button', /Request Code/i).click();
    cy.wait('@requestCodeForInvalidTest');

    cy.get('input[id="validation-code"]').should('be.visible').type(invalidVerificationCode);
    cy.contains('button', /Verify Code/i).click();
    cy.wait('@verifyCodeFail');

    cy.contains(/Invalid validation code. Please try again./i).should('be.visible');
    cy.get('input[id="validation-code"]').should('be.enabled').and('have.value', invalidVerificationCode);
    cy.get('input[id="api-id"]').should('be.disabled');
  });

  it('Scenario 5: Shows loading state on buttons', () => {
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.phoneNumber === testPhoneNumber && !req.body.validationCode && !req.body.action ) {
        req.reply({
          delay: 500,
          statusCode: 200,
          body: { success: true, requiresValidation: true, message: 'Validation code sent', phoneRegistered: true },
        });
      }
    }).as('requestCodeDelayed');

    cy.get('input[id="api-id"]').type(testApiId);
    cy.get('input[id="api-hash"]').type(testApiHash);
    cy.get('input[id="phone-number"]').type(testPhoneNumber);

    const requestCodeButton = cy.contains('button', /Request Code/i);
    requestCodeButton.click();

    // Check for button being disabled or containing a spinner
    // This depends on how <Loader2 /> is structured. If it's a child, button might not be disabled.
    // Instead, check for the spinner's presence within the button.
    requestCodeButton.find('svg.animate-spin').should('be.visible');
    // Or, if the button text changes:
    // requestCodeButton.contains(/Loading.../i).should('be.visible'); // Example text

    cy.wait('@requestCodeDelayed');
    // After wait, spinner should be gone, button text reset, and button enabled
    requestCodeButton.find('svg.animate-spin').should('not.exist');
    requestCodeButton.should('not.be.disabled');
    cy.get('input[id="validation-code"]').should('be.visible'); // Next state
  });
});
