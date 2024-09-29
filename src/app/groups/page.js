'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchError = localStorage.getItem('fetchError');
    if (fetchError) {
      setError(fetchError);
      localStorage.removeItem('fetchError');
    }

    const fetchGroups = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('*');
        
        if (error) throw error;
        setGroups(data);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Failed to load groups. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedGroups(selectAll ? [] : groups.map(group => group.id));
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroups(prevSelected =>
      prevSelected.includes(groupId)
        ? prevSelected.filter(id => id !== groupId)
        : [...prevSelected, groupId]
    );
  };

  const handleDownloadCSV = () => {
    // Implement CSV download logic here
    console.log('Downloading CSV for selected groups:', selectedGroups);
  };

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-10">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <h2 className="text-2xl font-bold mb-4">Groups List</h2>
      <div className="mb-4 space-y-2">
        <div>
          <Label htmlFor="api-id">API ID</Label>
          <Input
            id="api-id"
            type="text"
            placeholder="Enter your API ID"
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="api-hash">API Hash</Label>
          <Input
            id="api-hash"
            type="text"
            placeholder="Enter your API Hash"
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="phone-number">Phone Number</Label>
          <Input
            id="phone-number"
            type="text"
            placeholder="Enter your phone number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <Button onClick={handleFetchFromTelegram} disabled={isFetchingFromTelegram}>
          {isFetchingFromTelegram ? 'Fetching...' : 'Fetch Groups from Telegram'}
        </Button>
      </div>
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
            <TableHead>Group Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Invite Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell>
                <Checkbox
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={() => handleSelectGroup(group.id)}
                />
              </TableCell>
              <TableCell>{group.group_name}</TableCell>
              <TableCell>{group.description}</TableCell>
              <TableCell>
                <a href={group.invite_link} target="_blank" rel="noopener noreferrer">
                  {group.invite_link}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={() => console.log("Selected groups:", selectedGroups)}>Extract Selected Groups</Button>
    </div>
  );
}
