'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';
import { toast } from 'react-hot-toast';

const ITEMS_PER_PAGE = 20;

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchContacts();
  }, [currentPage]);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error, count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setContacts(data || []); // Ensure contacts is always an array
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
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
      const csvContent = generateCSV(selectedData, ['id', 'first_name', 'last_name', 'username', 'phone_number', 'bio', 'online_status']);
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

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      {contacts.length === 0 ? (
        <p>No contacts found. Try extracting contacts first.</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Bio</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>{`${contact.first_name} ${contact.last_name}`}</TableCell>
                  <TableCell>{contact.username}</TableCell>
                  <TableCell>{contact.phone_number}</TableCell>
                  <TableCell>{contact.bio}</TableCell>
                  <TableCell>
                    <span className={contact.online_status === 'Online' ? 'text-green-500' : 'text-gray-500'}>
                      {contact.online_status || 'Offline'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
