'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';
import { toast } from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchGroups();
  }, [currentPage]);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const { data, error, count } = await supabase
        .from('groups')
        .select('*', { count: 'exact' })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setGroups(data);
      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching groups:', error);
      setError('Failed to load groups. Please try again.');
      toast.error('Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleExtract = async () => {
    try {
      setIsExtracting(true);
      const selectedData = groups.filter(group => selectedGroups.includes(group.id));
      const csvContent = generateCSV(selectedData, ['id', 'group_name', 'description', 'invite_link']);
      downloadCSV(csvContent, 'extracted_groups.csv');
      toast.success('Groups extracted successfully');
    } catch (error) {
      console.error('Error extracting groups:', error);
      setError('Failed to extract groups. Please try again.');
      toast.error('Failed to extract groups');
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
      <h2 className="text-2xl font-bold mb-4">Groups List</h2>
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
                <a href={group.invite_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {group.invite_link}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex justify-between items-center">
        <Button 
          onClick={handleExtract} 
          disabled={selectedGroups.length === 0 || isExtracting}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          {isExtracting ? 'Extracting...' : `Extract Selected Groups (${selectedGroups.length})`}
        </Button>
        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setCurrentPage} 
        />
      </div>
    </div>
  );
}
