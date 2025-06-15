'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination"; // Assuming this is a custom or shadcn component
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';
import { toast } from 'react-hot-toast';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from 'date-fns';

/**
 * @typedef {Object} Contact
 * @property {string} id - UUID
 * @property {string | null} user_id - Telegram user ID string
 * @property {string | null} first_name
 * @property {string | null} last_name
 * @property {string | null} username
 * @property {string | null} phone_number
 * @property {string | null} bio
 * @property {string | null} profile_photo_url
 * @property {boolean | null} is_bot
 * @property {string} extracted_at - ISO date string
 * @property {string} updated_at - ISO date string
 * @property {string | null} owner_id - UUID of the user who extracted this contact
 */

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function ContactsList() {
  /** @type {[Contact[], React.Dispatch<React.SetStateAction<Contact[]>>]} */
  const [contacts, setContacts] = useState([]);
  /** @type {[string[], React.Dispatch<React.SetStateAction<string[]>>]} */
  const [selectedContacts, setSelectedContacts] = useState([]);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [selectAll, setSelectAll] = useState(false);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [isLoading, setIsLoading] = useState(true);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [isExtracting, setIsExtracting] = useState(false);
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [error, setError] = useState(null);
  /** @type {[number, React.Dispatch<React.SetStateAction<number>>]} */
  const [currentPage, setCurrentPage] = useState(1);
  /** @type {[number, React.Dispatch<React.SetStateAction<number>>]} */
  const [totalPages, setTotalPages] = useState(0);
  /** @type {[number, React.Dispatch<React.SetStateAction<number>>]} */
  const [itemsPerPage, setItemsPerPage] = useState(20);
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * @typedef {Object} VisibleColumnsState
   * @property {boolean} name
   * @property {boolean} username
   * @property {boolean} phone_number
   * @property {boolean} bio
   * @property {boolean} profile_photo_url
   * @property {boolean} is_bot
   * @property {boolean} extracted_at
   * @property {boolean} updated_at
   */
  /** @type {[VisibleColumnsState, React.Dispatch<React.SetStateAction<VisibleColumnsState>>]} */
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    username: true,
    phone_number: true,
    bio: true,
    profile_photo_url: true,
    is_bot: true,
    extracted_at: true,
    updated_at: true,
  });

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'username', label: 'Username' },
    { key: 'phone_number', label: 'Phone Number' },
    { key: 'bio', label: 'Bio' },
    { key: 'profile_photo_url', label: 'Profile Photo' },
    { key: 'is_bot', label: 'Bot' },
    { key: 'extracted_at', label: 'Extracted At' },
    { key: 'updated_at', label: 'Updated At' },
  ];

  useEffect(() => {
    fetchContacts();
  }, [currentPage, itemsPerPage, searchQuery]);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' });

      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`);
      }

      const { data, error: dbError, count } = await query
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)
        .order('updated_at', { ascending: false }); // Default sort order

      if (dbError) throw dbError;
      setContacts(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (err) {
      const fetchErr = /** @type {Error} */ (err);
      console.error('Error fetching contacts:', fetchErr);
      setError('Failed to load contacts. Please try again.');
      toast.error('Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedContacts(selectAll ? [] : contacts.map(contact => contact.id));
  };

  /** @param {string} contactId */
  const handleSelectContact = (contactId) => {
    setSelectedContacts(prevSelected =>
      prevSelected.includes(contactId)
        ? prevSelected.filter(id => id !== contactId)
        : [...prevSelected, contactId]
    );
  };

  const handleExtract = async () => {
    try {
      setIsExtracting(true);
      const selectedData = contacts.filter(contact => selectedContacts.includes(contact.id));
      // Ensure only visible columns are extracted
      const fieldsToExtract = columns.filter(col => visibleColumns[/** @type {keyof VisibleColumnsState} */ (col.key)]).map(col => col.key);
      // Special handling for 'name' as it's combined from first_name and last_name
      const dataForCSV = selectedData.map(contact => {
        /** @type {Record<string, any>} */
        const record = {};
        fieldsToExtract.forEach(field => {
            if (field === 'name') {
                record[field] = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
            } else {
                record[field] = contact[/** @type {keyof Contact} */ (field)];
            }
        });
        return record;
      });

      const csvContent = generateCSV(dataForCSV, fieldsToExtract);
      downloadCSV(csvContent, 'extracted_contacts.csv');
      toast.success('Contacts extracted successfully');
    } catch (err) {
      const extractErr = /** @type {Error} */ (err);
      console.error('Error extracting contacts:', extractErr);
      setError('Failed to extract contacts. Please try again.');
      toast.error('Failed to extract contacts');
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * @param {string} content
   * @param {string} fileName
   */
  const downloadCSV = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  /** @param {React.ChangeEvent<HTMLInputElement>} e */
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  /** @param {string} value */
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  /** @param {keyof VisibleColumnsState} columnKey */
  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  // visibleColumnsCount is not directly used in JSX, so type is optional here unless exported or complex
  const visibleColumnsCount = useMemo(() => Object.values(visibleColumns).filter(Boolean).length, [visibleColumns]);


  if (isLoading && contacts.length === 0) { // Show loading only on initial load
    return <div className="flex justify-center items-center h-screen">Loading contacts...</div>;
  }

  if (error && contacts.length === 0) { // Show error prominently if no data could be loaded
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>} {/* Show error even if some data is loaded */}
      <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
        <Input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
        <div className="flex items-center space-x-2">
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Items per page" />
            </SelectTrigger>
            <SelectContent>
              {ITEMS_PER_PAGE_OPTIONS.map(option => (
                <SelectItem key={option} value={option.toString()}>{option} per page</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {columns.map(column => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[/** @type {keyof VisibleColumnsState} */ (column.key)]}
                  onCheckedChange={() => toggleColumn(/** @type {keyof VisibleColumnsState} */ (column.key))}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {contacts.length === 0 && !isLoading ? (
        <p>No contacts found. Try adjusting your search or extracting contacts first.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center">
            <Checkbox
              id="select-all"
              checked={selectAll && contacts.length > 0} // Ensure selectAll is false if no contacts
              onCheckedChange={handleSelectAll}
              disabled={contacts.length === 0}
            />
            <label htmlFor="select-all" className="ml-2">
              {selectAll ? "Unselect All" : "Select All"} ({selectedContacts.length} selected)
            </label>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Select</TableHead>
                  {columns.map(column => visibleColumns[/** @type {keyof VisibleColumnsState} */ (column.key)] && (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => handleSelectContact(contact.id)}
                      />
                    </TableCell>
                    {visibleColumns.name && (
                      <TableCell>{`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}</TableCell>
                    )}
                    {visibleColumns.username && (
                      <TableCell>{contact.username || '-'}</TableCell>
                    )}
                    {visibleColumns.phone_number && (
                      <TableCell>{contact.phone_number || '-'}</TableCell>
                    )}
                    {visibleColumns.bio && (
                      <TableCell className="max-w-xs truncate">{contact.bio || '-'}</TableCell>
                    )}
                    {visibleColumns.profile_photo_url && (
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={contact.profile_photo_url ?? undefined} alt={`${contact.first_name || ''} ${contact.last_name || ''}`} />
                          <AvatarFallback>{(contact.first_name?.[0] || '') + (contact.last_name?.[0] || '')}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                    )}
                    {visibleColumns.is_bot && (
                      <TableCell>{contact.is_bot ? 'Yes' : 'No'}</TableCell>
                    )}
                    {visibleColumns.extracted_at && (
                      <TableCell>{contact.extracted_at ? format(new Date(contact.extracted_at), 'PP pp') : '-'}</TableCell>
                    )}
                    {visibleColumns.updated_at && (
                      <TableCell>{contact.updated_at ? format(new Date(contact.updated_at), 'PP pp') : '-'}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
            <Button 
              onClick={handleExtract} 
              disabled={selectedContacts.length === 0 || isExtracting}
            >
              {isExtracting ? 'Extracting...' : `Extract Selected (${selectedContacts.length})`}
            </Button>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
