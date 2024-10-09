'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';
import { toast } from 'react-hot-toast';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from 'date-fns';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
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

      const { data, error, count } = await query
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;
      setContacts(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching contacts:', error);
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
      const csvContent = generateCSV(selectedData, Object.keys(visibleColumns).filter(key => visibleColumns[key]));
      downloadCSV(csvContent, 'extracted_contacts.csv');
      toast.success('Contacts extracted successfully');
    } catch (error) {
      console.error('Error extracting contacts:', error);
      setError('Failed to extract contacts. Please try again.');
      toast.error('Failed to extract contacts');
    } finally {
      setIsExtracting(false);
    }
  };

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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const visibleColumnsCount = useMemo(() => Object.values(visibleColumns).filter(Boolean).length, [visibleColumns]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      <div className="mb-4 flex justify-between items-center">
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
              <SelectValue placeholder="Select items per page" />
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
                  checked={visibleColumns[column.key]}
                  onCheckedChange={() => toggleColumn(column.key)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {contacts.length === 0 ? (
        <p>No contacts found. Try adjusting your search or extracting contacts first.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="ml-2">
              {selectAll ? "Unselect All" : "Select All"}
            </label>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Select</TableHead>
                  {columns.map(column => visibleColumns[column.key] && (
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
                      <TableCell>{`${contact.first_name} ${contact.last_name}`}</TableCell>
                    )}
                    {visibleColumns.username && (
                      <TableCell>{contact.username}</TableCell>
                    )}
                    {visibleColumns.phone_number && (
                      <TableCell>{contact.phone_number}</TableCell>
                    )}
                    {visibleColumns.bio && (
                      <TableCell>{contact.bio}</TableCell>
                    )}
                    {visibleColumns.profile_photo_url && (
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={contact.profile_photo_url} alt={`${contact.first_name} ${contact.last_name}`} />
                          <AvatarFallback>{contact.first_name[0]}{contact.last_name[0]}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                    )}
                    {visibleColumns.is_bot && (
                      <TableCell>{contact.is_bot ? 'Yes' : 'No'}</TableCell>
                    )}
                    {visibleColumns.extracted_at && (
                      <TableCell>{format(new Date(contact.extracted_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                    )}
                    {visibleColumns.updated_at && (
                      <TableCell>{format(new Date(contact.updated_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <Button 
              onClick={handleExtract} 
              disabled={selectedContacts.length === 0 || isExtracting}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              {isExtracting ? 'Extracting...' : `Extract Selected Contacts (${selectedContacts.length})`}
            </Button>
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>
        </>
      )}
    </div>
  );
}
