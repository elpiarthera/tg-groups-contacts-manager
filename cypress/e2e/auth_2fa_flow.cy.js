// cypress/e2e/auth_2fa_flow.cy.js

describe('Full Authentication Flow with 2FA', () => {
  const testApiId = '7654321'; // Different from basic flow for clarity
  const testApiHash = 'anotherdummyhash0987654321fedcba';
  const testPhoneNumber2FA = '+15551234561'; // Specific phone number that mock will identify as needing 2FA
  const validVerificationCode = '54321'; // Different code for this flow
  const valid2FAPassword = 'securePassword123';
  const invalid2FAPassword = 'wrongPassword';

  beforeEach(() => {
    // Default intercept for checkSession if it's called on load/blur
    // This should be specific enough not to interfere if other tests run,
    // or be overridden by more specific intercepts in tests.
    cy.intercept('POST', '/api/extract-data', (req) => {
      if (req.body.action === 'checkSession') {
        // For these tests, assume no active session initially for the specific test phone number
        if (req.body.phoneNumber === testPhoneNumber2FA) {
          req.reply({ statusCode: 200, body: { hasSession: false } });
        } else {
          // Fallback for other numbers if any other tests run concurrently or pages make other calls.
          // Or, simply let it be unhandled if this intercept is only for this describe block.
          req.alias = 'checkSessionDefault_unmatched_number'; // So we can see if it was unexpectedly called
          req.reply({ statusCode: 200, body: { hasSession: false } });
        }
      }
      // If no action: 'checkSession', this intercept does not apply.
      // More specific intercepts in tests will handle other calls.
    }).as('checkSessionDefault');

    cy.visit('/');
    cy.get('input[id="api-id"]').should('be.visible'); // Ensure page is loaded
  });

  it('Scenario 1: Successfully authenticates with valid credentials, code, and 2FA password', () => {
    // This intercept handles all stages of the 2FA flow for this specific test
    cy.intercept('POST', '/api/extract-data', (req) => {
      const body = req.body;
      // Check if it's not a checkSession call, as that's handled by the beforeEach intercept
      if (body.action === 'checkSession') {
        // Let the beforeEach intercept handle this
        return; // Or req.continue() if that's preferred for passthrough
      }

      if (body.phoneNumber === testPhoneNumber2FA && !body.validationCode && !body.twoFactorPassword) {
        // Requesting code for 2FA user
        req.reply({
          statusCode: 200,
          body: { success: true, requiresValidation: true, message: 'Validation code sent (2FA user)', phoneRegistered: true },
        });
      } else if (body.phoneNumber === testPhoneNumber2FA && body.validationCode === validVerificationCode && !body.twoFactorPassword) {
        // Verifying code, server responds that 2FA is needed
        req.reply({
          statusCode: 200, // The API route for extract-data returns 200 even when requires2FA is true
          body: { success: false, requires2FA: true, message: 'Please enter your 2FA password.' },
        });
      } else if (body.phoneNumber === testPhoneNumber2FA && body.validationCode === validVerificationCode && body.twoFactorPassword === valid2FAPassword) {
        // Verifying 2FA password
        req.reply({
          statusCode: 200,
          body: { success: true, message: '2FA Authentication successful. You can now extract data.' },
        });
      } else {
        // Fallback for unexpected calls to this intercept during this test
        req.reply({statusCode: 500, body: { error: `Unexpected call to 2FA intercept: ${JSON.stringify(body)}` }})
      }
    }).as('auth2FAApiCall');

    cy.get('input[id="api-id"]').type(testApiId);
    cy.get('input[id="api-hash"]').type(testApiHash);
    cy.get('input[id="phone-number"]').type(testPhoneNumber2FA);

    cy.contains('button', /Request Code/i).click();
    cy.wait('@auth2FAApiCall'); // For requestCode

    cy.contains(/Validation code sent \(2FA user\)/i).should('be.visible');
    cy.get('input[id="validation-code"]').should('be.visible').type(validVerificationCode);

    cy.contains('button', /Verify Code/i).click();
    cy.wait('@auth2FAApiCall'); // For verifyCode leading to 2FA prompt

    cy.contains(/Please enter your 2FA password./i).should('be.visible');
    cy.get('input[id="two-factor-password"]').should('be.visible').type(valid2FAPassword);

    cy.contains('button', /Submit 2FA Password/i).click();
    cy.wait('@auth2FAApiCall'); // For 2FA password verification

    cy.contains(/2FA Authentication successful/i).should('be.visible');
    cy.contains('button', /Extract Data/i).should('be.enabled');
    cy.get('input[id="api-id"]').should('be.disabled');
    cy.get('input[id="two-factor-password"]').should('be.disabled'); // Assuming it gets disabled on success
    cy.contains('button', /Logout/i).should('be.visible');
  });

  it('Scenario 2: Handles incorrect 2FA password', () => {
    cy.intercept('POST', '/api/extract-data', (req) => {
      const body = req.body;
      if (body.action === 'checkSession') return;

      if (body.phoneNumber === testPhoneNumber2FA && !body.validationCode && !body.twoFactorPassword) {
        req.reply({ statusCode: 200, body: { success: true, requiresValidation: true, message: 'Validation code sent (2FA user)', phoneRegistered: true }});
      } else if (body.phoneNumber === testPhoneNumber2FA && body.validationCode === validVerificationCode && !body.twoFactorPassword) {
        req.reply({ statusCode: 200, body: { success: false, requires2FA: true, message: 'Please enter your 2FA password.' }});
      } else if (body.phoneNumber === testPhoneNumber2FA && body.validationCode === validVerificationCode && body.twoFactorPassword === invalid2FAPassword) {
        // API responds with error for invalid 2FA password
        req.reply({ statusCode: 400, body: { success: false, message: 'Invalid 2FA password. Please try again.' }});
      } else {
        req.reply({statusCode: 500, body: { error: `Unexpected call to incorrect 2FA intercept: ${JSON.stringify(body)}` }})
      }
    }).as('auth2FAApiCall');

    cy.get('input[id="api-id"]').type(testApiId);
    cy.get('input[id="api-hash"]').type(testApiHash);
    cy.get('input[id="phone-number"]').type(testPhoneNumber2FA);
    cy.contains('button', /Request Code/i).click();
    cy.wait('@auth2FAApiCall'); // requestCode

    cy.get('input[id="validation-code"]').type(validVerificationCode);
    cy.contains('button', /Verify Code/i).click();
    cy.wait('@auth2FAApiCall'); // verifyCode -> 2FA prompt

    cy.get('input[id="two-factor-password"]').should('be.visible').type(invalid2FAPassword);
    cy.contains('button', /Submit 2FA Password/i).click();
    cy.wait('@auth2FAApiCall'); // 2FA submit (fail)

    cy.contains(/Invalid 2FA password/i).should('be.visible');
    cy.get('input[id="two-factor-password"]').should('be.enabled').and('have.value', invalid2FAPassword);
    cy.get('input[id="api-id"]').should('be.disabled');
  });
});
