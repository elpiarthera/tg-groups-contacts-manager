import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelegramManager from '../TelegramManager';
import { supabase } from '@/lib/supabase'; // For mocking supabase.auth.getSession

// Mock supabase for frontend session checks used in handleLogout
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// next/navigation is globally mocked in jest.setup.js

describe('TelegramManager Component Integration Tests', () => {
  const user = userEvent.setup();

  const fillCredentials = (phone = '+12345678900') => {
    fireEvent.change(screen.getByLabelText(/API ID/i), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText(/API Hash/i), { target: { value: 'validhash' } }); // Use a hash that might be checked by MSW for specific session logic
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: phone } });
  };

  const fill2FAPhoneCredentials = () => {
    fireEvent.change(screen.getByLabelText(/API ID/i), { target: { value: '67890' } });
    fireEvent.change(screen.getByLabelText(/API Hash/i), { target: { value: 'anotherhash' } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '+19998887777' } }); // Number that will trigger 2FA in MSW handler
  };

  test('full authentication flow (code request, code verify)', async () => {
    render(<TelegramManager />);
    fillCredentials();

    await user.click(screen.getByRole('button', { name: /Request Code/i }));
    // MSW handler for 'checkSession' (called internally first) and then 'sendCode'
    await waitFor(() => expect(screen.getByText(/Code sent/i)).toBeInTheDocument(), { timeout: 3000 }); // Increased timeout

    const validationCodeInput = screen.getByLabelText(/Validation Code/i);
    expect(validationCodeInput).toBeInTheDocument();
    fireEvent.change(validationCodeInput, { target: { value: '12345' } }); // Correct code as per MSW

    await user.click(screen.getByRole('button', { name: /Verify Code/i }));
    await waitFor(() => expect(screen.getByText(/Authentication successful/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /Extract Data/i})).not.toBeDisabled();
  });

  test('authentication flow with 2FA', async () => {
     render(<TelegramManager />);
     fill2FAPhoneCredentials();

     await user.click(screen.getByRole('button', {name: /Request Code/i}));
     await waitFor(() => expect(screen.getByText(/Code sent to 2FA number/i)).toBeInTheDocument(), { timeout: 3000 });

     const validationCodeInput = screen.getByLabelText(/Validation Code/i);
     fireEvent.change(validationCodeInput, {target: {value: '12345'}});
     await user.click(screen.getByRole('button', {name: /Verify Code/i}));

     // Expect 2FA input to appear
     await waitFor(() => expect(screen.getByText(/Please enter your 2FA password./i)).toBeInTheDocument(), { timeout: 3000 });
     const twoFactorInput = screen.getByLabelText(/2FA Password/i);
     expect(twoFactorInput).toBeInTheDocument();
     fireEvent.change(twoFactorInput, {target: {value: 'password123'}}); // Correct 2FA password

     await user.click(screen.getByRole('button', {name: /Submit 2FA Password/i}));
     await waitFor(() => expect(screen.getByText(/2FA Authentication successful/i)).toBeInTheDocument(), { timeout: 3000 });
     expect(screen.getByRole('button', { name: /Extract Data/i})).not.toBeDisabled();
  });

  test('handles logout correctly after authentication', async () => {
     render(<TelegramManager />);
     // Step 1: Authenticate first (simplified version of the first test)
     fillCredentials('+12345670000'); // Use a number that MSW checkSession might recognize for existing session, or just proceed to full auth

     // Mocking checkSession to return { hasSession: false } initially for this test run if needed
     // (Assuming MSW is reset or specific handler can be overridden if needed for this test)

     await user.click(screen.getByRole('button', { name: /Request Code/i }));
     await waitFor(() => expect(screen.getByText(/Code sent/i)).toBeInTheDocument(), { timeout: 3000 });
     fireEvent.change(screen.getByLabelText(/Validation Code/i), { target: { value: '12345' } });
     await user.click(screen.getByRole('button', { name: /Verify Code/i }));
     await waitFor(() => expect(screen.getByText(/Authentication successful/i)).toBeInTheDocument(), { timeout: 3000 });

     // Step 2: Test logout
     const logoutButton = screen.getByRole('button', { name: /Logout/i });
     expect(logoutButton).toBeInTheDocument();
     await user.click(logoutButton);

     await waitFor(() => expect(screen.getByText(/Logged out successfully./i)).toBeInTheDocument(), { timeout: 3000 });
     expect(screen.getByRole('button', { name: /Request Code/i })).toBeInTheDocument();
     expect(screen.queryByRole('button', { name: /Logout/i })).not.toBeInTheDocument();
     // Check if inputs are re-enabled
     expect(screen.getByLabelText(/API ID/i)).not.toBeDisabled();
  });

  test('shows error for invalid validation code', async () => {
    render(<TelegramManager />);
    fillCredentials();
    await user.click(screen.getByRole('button', { name: /Request Code/i }));
    await waitFor(() => expect(screen.getByText(/Code sent/i)).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.change(screen.getByLabelText(/Validation Code/i), { target: { value: 'wrongcode' } });
    await user.click(screen.getByRole('button', { name: /Verify Code/i }));

    await waitFor(() => expect(screen.getByText(/Invalid validation code./i)).toBeInTheDocument(), { timeout: 3000 });
  });

  test('shows error for invalid 2FA password', async () => {
    render(<TelegramManager />);
    fill2FAPhoneCredentials();
    await user.click(screen.getByRole('button', {name: /Request Code/i}));
    await waitFor(() => expect(screen.getByText(/Code sent to 2FA number/i)).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.change(screen.getByLabelText(/Validation Code/i), {target: {value: '12345'}});
    await user.click(screen.getByRole('button', {name: /Verify Code/i}));

    await waitFor(() => expect(screen.getByText(/Please enter your 2FA password./i)).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.change(screen.getByLabelText(/2FA Password/i), {target: {value: 'wrongpassword'}});
    await user.click(screen.getByRole('button', {name: /Submit 2FA Password/i}));

    await waitFor(() => expect(screen.getByText(/Invalid 2FA password./i)).toBeInTheDocument(), { timeout: 3000 });
  });

  // Test for data extraction button click after authentication
  test('can click extract data after successful authentication', async () => {
    render(<TelegramManager />);
    fillCredentials();
    await user.click(screen.getByRole('button', { name: /Request Code/i }));
    await waitFor(() => expect(screen.getByText(/Code sent/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Validation Code/i), { target: { value: '12345' } });
    await user.click(screen.getByRole('button', { name: /Verify Code/i }));
    await waitFor(() => expect(screen.getByText(/Authentication successful/i)).toBeInTheDocument());

    // Select "groups" (default)
    const extractButton = screen.getByRole('button', { name: /Extract Data/i });
    expect(extractButton).not.toBeDisabled();
    await user.click(extractButton);

    // Check for success message from extraction
    await waitFor(() => expect(screen.getByText(/Extracted groups successfully. Found 1 item./i)).toBeInTheDocument());
  });

});
