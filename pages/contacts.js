import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Import Supabase client
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Fetch contacts from Supabase
  useEffect(() => {
    const fetchContacts = async () => {
      const { data, error } = await supabase
        .from('contacts') // Fetch from the "contacts" table
        .select('*');
      
      if (error) {
        console.error('Error fetching contacts:', error);
      } else {
        setContacts(data); // Set the fetched data into state
      }
    };

    fetchContacts();
  }, []);

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

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      <Checkbox
        id="select-all"
        checked={selectAll}
        onCheckedChange={handleSelectAll}
        label={selectAll ? "Unselect All" : "Select All"}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Bio</TableHead>
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
              <TableCell>@{contact.username || 'N/A'}</TableCell>
              <TableCell>{contact.phone_number || 'N/A'}</TableCell>
              <TableCell>{contact.bio || 'N/A'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={() => console.log("Selected contacts:", selectedContacts)}>Extract Selected Contacts</Button>
    </div>
  );
}
