// src/components/__tests__/GroupsList.test.jsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsList from '../GroupsList';
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
  success: jest.fn(),
  error: jest.fn(),
}));

// Mock window.URL.createObjectURL and link.click for CSV download
global.URL.createObjectURL = jest.fn(() => 'mock_url');
const mockLinkClick = jest.fn();
const originalHTMLAnchorElementClick = HTMLAnchorElement.prototype.click; // Store original
HTMLAnchorElement.prototype.click = mockLinkClick;


const mockGroups = [
  { id: 'g1', group_id: 'tg_g1', group_name: 'Tech Talk', description: 'Discussions about tech', participant_count: 100, type: 'group', is_public: true, creation_date: new Date().toISOString(), invite_link: 'http://t.me/techtalk', extracted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'g2', group_id: 'tg_g2', group_name: 'Crypto Fans', description: 'All about crypto', participant_count: 250, type: 'channel', is_public: true, creation_date: new Date().toISOString(), invite_link: 'http://t.me/cryptofans', extracted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'g3', group_id: 'tg_g3', group_name: 'NextJS Developers', description: 'Next.js community', participant_count: 50, type: 'group', is_public: false, creation_date: new Date().toISOString(), invite_link: 'http://t.me/nextdevs', extracted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

describe('GroupsList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful fetch mock
    supabase.order.mockResolvedValue({ data: mockGroups, error: null, count: mockGroups.length });
    // Default successful search mock (can be overridden in specific tests)
    supabase.or.mockReturnThis();
    csvUtils.generateCSV.mockReturnValue('mock,group_csv,content');

    HTMLAnchorElement.prototype.setAttribute = jest.fn();
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  afterAll(() => {
    HTMLAnchorElement.prototype.click = originalHTMLAnchorElementClick; // Restore original
  });

  test('fetches and displays groups on mount', async () => {
    render(<GroupsList />);
    expect(supabase.from).toHaveBeenCalledWith('groups');
    expect(supabase.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(supabase.range).toHaveBeenCalled();
    expect(supabase.order).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Tech Talk')).toBeInTheDocument();
      expect(screen.getByText('Crypto Fans')).toBeInTheDocument();
      expect(screen.getByText('NextJS Developers')).toBeInTheDocument();
      expect(screen.getByText(/Discussions about tech/i)).toBeInTheDocument(); // Description
      expect(screen.getByText('100')).toBeInTheDocument(); // Participant count for Tech Talk
    });
  });

  test('handles empty group list', async () => {
    supabase.order.mockResolvedValueOnce({ data: [], error: null, count: 0 });
    render(<GroupsList />);
    await waitFor(() => {
      expect(screen.getByText(/No groups found/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Group Name')).toBeInTheDocument(); // Check headers
  });

  test('handles error during fetch', async () => {
    supabase.order.mockResolvedValueOnce({ data: null, error: { message: 'Test Supabase group fetch error' }, count: 0 });
    render(<GroupsList />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load groups. Please try again./i)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Failed to load groups');
    });
  });

  test('allows selecting and deselecting groups', async () => {
    const user = userEvent.setup();
    render(<GroupsList />);
    await waitFor(() => expect(screen.getByText('Tech Talk')).toBeInTheDocument());

    const techTalkRow = screen.getByText('Tech Talk').closest('tr');
    const techTalkCheckbox = techTalkRow.querySelector('input[type="checkbox"]');

    expect(techTalkCheckbox).not.toBeChecked();
    await user.click(techTalkCheckbox);
    expect(techTalkCheckbox).toBeChecked();

    await user.click(techTalkCheckbox);
    expect(techTalkCheckbox).not.toBeChecked();
  });

  test('allows selecting all and deselecting all groups', async () => {
     const user = userEvent.setup();
     render(<GroupsList />);
     await waitFor(() => expect(screen.getByText('Tech Talk')).toBeInTheDocument());

     const selectAllCheckbox = screen.getByLabelText(/Select All/i);
     await user.click(selectAllCheckbox);

     const rowCheckboxes = screen.getAllByRole('checkbox').filter(cb => cb !== selectAllCheckbox);
     rowCheckboxes.forEach(cb => expect(cb).toBeChecked());

     await user.click(selectAllCheckbox);
     rowCheckboxes.forEach(cb => expect(cb).not.toBeChecked());
  });

  test('handles CSV export for selected groups', async () => {
    const user = userEvent.setup();
    render(<GroupsList />);
    await waitFor(() => expect(screen.getByText('Tech Talk')).toBeInTheDocument());

    const techTalkRow = screen.getByText('Tech Talk').closest('tr');
    const techTalkCheckbox = techTalkRow.querySelector('input[type="checkbox"]');
    await user.click(techTalkCheckbox); // Select Tech Talk

    const exportButton = screen.getByRole('button', { name: /Extract Selected/i }); // Dynamic name
    await user.click(exportButton);

    expect(csvUtils.generateCSV).toHaveBeenCalledWith(
      [expect.objectContaining({ group_name: 'Tech Talk' })],
      expect.arrayContaining(['group_name', 'description', 'participant_count']) // Check some expected fields
    );
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockLinkClick).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Groups exported successfully');
  });

  test('search functionality filters groups', async () => {
     const user = userEvent.setup();
     supabase.order.mockResolvedValueOnce({ data: mockGroups, error: null, count: mockGroups.length });
     render(<GroupsList />);
     await waitFor(() => {
         expect(screen.getByText('Tech Talk')).toBeInTheDocument();
         expect(screen.getByText('Crypto Fans')).toBeInTheDocument();
     });

     const searchInput = screen.getByPlaceholderText(/Search groups.../i);

     supabase.order.mockResolvedValueOnce({ data: [mockGroups[0]], error: null, count: 1 });
     await user.type(searchInput, 'Tech');

     await waitFor(() => {
         expect(screen.getByText('Tech Talk')).toBeInTheDocument();
         expect(screen.queryByText('Crypto Fans')).not.toBeInTheDocument();
     });
     expect(supabase.or).toHaveBeenCalledWith(expect.stringContaining('Tech'));

     supabase.order.mockResolvedValueOnce({ data: [], error: null, count: 0 });
     await user.clear(searchInput);
     await user.type(searchInput, 'NonExistentGroup');

     await waitFor(() => {
         expect(screen.queryByText('Tech Talk')).not.toBeInTheDocument();
         expect(screen.getByText(/No groups found matching your search/i)).toBeInTheDocument();
     });
     expect(supabase.or).toHaveBeenCalledWith(expect.stringContaining('NonExistentGroup'));
 });

 // Add tests for pagination, column visibility toggling etc.
});
