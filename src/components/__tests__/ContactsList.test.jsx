// src/components/__tests__/ContactsList.test.jsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactsList from '../ContactsList';
import { supabase } from '@/lib/supabase'; // To be mocked
import * as csvUtils from '@/lib/csvUtils'; // To mock generateCSV
import { toast } from 'react-hot-toast'; // To mock toast

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(), // Keep returning this for chaining
    or: jest.fn().mockReturnThis(),     // Mock 'or' for search
    range: jest.fn().mockReturnThis(),  // Mock 'range' for pagination
    order: jest.fn(),                  // Mock 'order' as the final call in the chain usually
  },
}));

// Mock csvUtils
jest.mock('@/lib/csvUtils', () => ({
  generateCSV: jest.fn(),
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock window.URL.createObjectURL and link.click for CSV download
global.URL.createObjectURL = jest.fn(() => 'mock_url');
const mockLinkClick = jest.fn();
// Store original and restore after tests if needed, but for Jest, this is usually fine.
const originalHTMLAnchorElementClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = mockLinkClick;


const mockContacts = [
  { id: '1', user_id: 'u1', first_name: 'Alice', last_name: 'Smith', username: 'alice', phone_number: '+111', extracted_at: new Date().toISOString(), updated_at: new Date().toISOString(), bio: 'Bio of Alice', is_bot: false, profile_photo_url: null },
  { id: '2', user_id: 'u2', first_name: 'Bob', last_name: 'Johnson', username: 'bobj', phone_number: '+222', extracted_at: new Date().toISOString(), updated_at: new Date().toISOString(), bio: 'Bio of Bob', is_bot: false, profile_photo_url: null },
  { id: '3', user_id: 'u3', first_name: 'Carol', last_name: 'Williams', username: 'carolw', phone_number: '+333', extracted_at: new Date().toISOString(), updated_at: new Date().toISOString(), bio: '', is_bot: true, profile_photo_url: null },
];

describe('ContactsList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful fetch mock
    supabase.order.mockResolvedValue({ data: mockContacts, error: null, count: mockContacts.length });
    // Default successful search mock (can be overridden in specific tests)
    supabase.or.mockReturnThis(); // Ensure 'or' returns 'this' for chaining to range/order
    csvUtils.generateCSV.mockReturnValue('mock,csv,content');

    // Mock anchor element methods used in downloadCSV
    HTMLAnchorElement.prototype.setAttribute = jest.fn();
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  afterAll(() => {
    // Restore original click method if necessary
    HTMLAnchorElement.prototype.click = originalHTMLAnchorElementClick;
  });

  test('fetches and displays contacts on mount', async () => {
    render(<ContactsList />);
    expect(supabase.from).toHaveBeenCalledWith('contacts');
    // Check if select is called (it's part of the chain)
    expect(supabase.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(supabase.range).toHaveBeenCalled(); // Check if pagination is applied
    expect(supabase.order).toHaveBeenCalled(); // Check if ordering is applied

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument(); // Username
      expect(screen.getByText('+222')).toBeInTheDocument(); // Phone
    });
  });

  test('handles empty contact list', async () => {
    supabase.order.mockResolvedValueOnce({ data: [], error: null, count: 0 });
    render(<ContactsList />);
    await waitFor(() => {
      expect(screen.getByText(/No contacts found/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Name')).toBeInTheDocument(); // Check headers
  });

  test('handles error during fetch', async () => {
    supabase.order.mockResolvedValueOnce({ data: null, error: { message: 'Test Supabase fetch error' }, count: 0 });
    render(<ContactsList />);
    await waitFor(() => {
      // The component sets a generic error message and toasts
      expect(screen.getByText(/Failed to load contacts. Please try again./i)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Failed to load contacts');
    });
  });

  test('allows selecting and deselecting contacts', async () => {
    const user = userEvent.setup();
    render(<ContactsList />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    // Find checkbox in Alice's row (more robustly)
    const aliceRow = screen.getByText('Alice Smith').closest('tr');
    const aliceCheckbox = aliceRow.querySelector('input[type="checkbox"]');

    expect(aliceCheckbox).not.toBeChecked();
    await user.click(aliceCheckbox);
    expect(aliceCheckbox).toBeChecked();

    await user.click(aliceCheckbox);
    expect(aliceCheckbox).not.toBeChecked();
  });

  test('allows selecting all and deselecting all contacts', async () => {
     const user = userEvent.setup();
     render(<ContactsList />);
     await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

     const selectAllCheckbox = screen.getByLabelText(/Select All/i);
     await user.click(selectAllCheckbox);

     const rowCheckboxes = screen.getAllByRole('checkbox').filter(cb => cb !== selectAllCheckbox);
     rowCheckboxes.forEach(cb => expect(cb).toBeChecked());

     await user.click(selectAllCheckbox);
     rowCheckboxes.forEach(cb => expect(cb).not.toBeChecked());
  });

  test('handles CSV export for selected contacts', async () => {
    const user = userEvent.setup();
    render(<ContactsList />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());

    const aliceRow = screen.getByText('Alice Smith').closest('tr');
    const aliceCheckbox = aliceRow.querySelector('input[type="checkbox"]');
    await user.click(aliceCheckbox); // Select Alice

    const exportButton = screen.getByRole('button', { name: /Extract Selected/i }); // Name is dynamic
    await user.click(exportButton);

    expect(csvUtils.generateCSV).toHaveBeenCalledWith(
      [expect.objectContaining({ first_name: 'Alice' })],
      expect.arrayContaining(['name', 'username', 'phone_number']) // Check if some default fields are there
    );
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockLinkClick).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Contacts extracted successfully');
  });

  test('search functionality filters contacts', async () => {
     const user = userEvent.setup();
     supabase.order.mockResolvedValueOnce({ data: mockContacts, error: null, count: mockContacts.length }); // Initial load
     render(<ContactsList />);
     await waitFor(() => {
         expect(screen.getByText('Alice Smith')).toBeInTheDocument();
         expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
     });

     const searchInput = screen.getByPlaceholderText(/Search contacts.../i);

     // Simulate Supabase returning filtered data for "Alice"
     supabase.order.mockResolvedValueOnce({ data: [mockContacts[0]], error: null, count: 1 });
     await user.type(searchInput, 'Alice');

     // Wait for the component to re-render with filtered data
     await waitFor(() => {
         expect(screen.getByText('Alice Smith')).toBeInTheDocument();
         expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
     });
     expect(supabase.or).toHaveBeenCalledWith(expect.stringContaining('Alice'));


     // Simulate Supabase returning no data for "NonExistent"
     supabase.order.mockResolvedValueOnce({ data: [], error: null, count: 0 });
     await user.clear(searchInput);
     await user.type(searchInput, 'NonExistent');

     await waitFor(() => {
         expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
         // The component shows "No contacts found..." when the contacts array is empty after filtering
         expect(screen.getByText(/No contacts found. Try adjusting your search or extracting contacts first./i)).toBeInTheDocument();
     });
     expect(supabase.or).toHaveBeenCalledWith(expect.stringContaining('NonExistent'));
 });

 // Add more tests for pagination, column visibility toggling etc.
});
