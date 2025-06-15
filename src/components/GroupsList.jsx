'use client'

import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination"; // Assuming custom/shadcn
import { Input } from "@/components/ui/input"; // For Search
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // For Items per page
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"; // For Columns
import { supabase } from '@/lib/supabase';
import { generateCSV } from '@/lib/csvUtils';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns'; // For date formatting


/**
 * @typedef {Object} Group
 * @property {string} id - UUID
 * @property {string | null} group_id - Telegram group/channel ID string
 * @property {string | null} group_name
 * @property {string | null} description
 * @property {string | null} invite_link
 * @property {number | null} participant_count
 * @property {string | null} type - 'group' or 'channel'
 * @property {boolean | null} is_public
 * @property {string} creation_date - ISO date string (approximated by last message date)
 * @property {string | null} owner_id - UUID of the user who extracted this group
 * @property {string} extracted_at - ISO date string (added by Supabase, if default is set)
 * @property {string} updated_at - ISO date string (added by Supabase, if default is set)
 */

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function GroupsList() {
  /** @type {[Group[], React.Dispatch<React.SetStateAction<Group[]>>]} */
  const [groups, setGroups] = useState([]);
  /** @type {[string[], React.Dispatch<React.SetStateAction<string[]>>]} */
  const [selectedGroups, setSelectedGroups] = useState([]);
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
   * @typedef {Object} VisibleGroupsColumnsState
   * @property {boolean} group_name
   * @property {boolean} type
   * @property {boolean} participant_count
   * @property {boolean} is_public
   * @property {boolean} description
   * @property {boolean} invite_link
   * @property {boolean} creation_date
   * @property {boolean} updated_at
   */
  /** @type {[VisibleGroupsColumnsState, React.Dispatch<React.SetStateAction<VisibleGroupsColumnsState>>]} */
  const [visibleColumns, setVisibleColumns] = useState({
    group_name: true,
    type: true,
    participant_count: true,
    is_public: true,
    description: true,
    invite_link: true,
    creation_date: true,
    updated_at: true,
  });

  const columns = [
    { key: 'group_name', label: 'Group Name' },
    { key: 'type', label: 'Type' },
    { key: 'participant_count', label: 'Participants' },
    { key: 'is_public', label: 'Public' },
    { key: 'description', label: 'Description' },
    { key: 'invite_link', label: 'Invite Link' },
    { key: 'creation_date', label: 'Creation Date (Approx.)' },
    { key: 'updated_at', label: 'Updated At' },
  ];


  useEffect(() => {
    fetchGroups();
  }, [currentPage, itemsPerPage, searchQuery]);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let query = supabase
        .from('groups')
        .select('*', { count: 'exact' });

      if (searchQuery) {
        query = query.or(`group_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,type.ilike.%${searchQuery}%`);
      }

      const { data, error: dbError, count } = await query
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)
        .order('updated_at', { ascending: false });


      if (dbError) throw dbError;
      setGroups(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (err) {
      const fetchErr = /** @type {Error} */ (err);
      console.error('Error fetching groups:', fetchErr);
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

  /** @param {string} groupId */
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
      const fieldsToExtract = columns.filter(col => visibleColumns[/** @type {keyof VisibleGroupsColumnsState} */ (col.key)]).map(col => col.key);
      const csvContent = generateCSV(selectedData, fieldsToExtract);
      downloadCSV(csvContent, 'extracted_groups.csv');
      toast.success('Groups extracted successfully');
    } catch (err) {
      const extractErr = /** @type {Error} */ (err);
      console.error('Error extracting groups:', extractErr);
      setError('Failed to extract groups. Please try again.');
      toast.error('Failed to extract groups');
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

  /** @param {keyof VisibleGroupsColumnsState} columnKey */
  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  // const visibleColumnsCount = useMemo(() => Object.values(visibleColumns).filter(Boolean).length, [visibleColumns]);

  if (isLoading && groups.length === 0) {
    return <div className="flex justify-center items-center h-screen">Loading groups...</div>;
  }

  if (error && groups.length === 0) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Groups List</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
       <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
        <Input
          type="text"
          placeholder="Search groups..."
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
                  checked={visibleColumns[/** @type {keyof VisibleGroupsColumnsState} */ (column.key)]}
                  onCheckedChange={() => toggleColumn(/** @type {keyof VisibleGroupsColumnsState} */ (column.key))}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {groups.length === 0 && !isLoading ? (
        <p>No groups found. Try extracting groups first.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center">
            <Checkbox
              id="select-all"
              checked={selectAll && groups.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={groups.length === 0}
            />
            <label htmlFor="select-all" className="ml-2">
              {selectAll ? "Unselect All" : "Select All"} ({selectedGroups.length} selected)
            </label>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Select</TableHead>
                  {columns.map(column => visibleColumns[/** @type {keyof VisibleGroupsColumnsState} */ (column.key)] && (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
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
                    {visibleColumns.group_name && <TableCell>{group.group_name || '-'}</TableCell>}
                    {visibleColumns.type && <TableCell>{group.type || '-'}</TableCell>}
                    {visibleColumns.participant_count && <TableCell>{group.participant_count ?? '-'}</TableCell>}
                    {visibleColumns.is_public && <TableCell>{group.is_public ? 'Yes' : 'No'}</TableCell>}
                    {visibleColumns.description && <TableCell className="max-w-xs truncate">{group.description || '-'}</TableCell>}
                    {visibleColumns.invite_link && (
                      <TableCell>
                        {group.invite_link ? (
                          <a href={group.invite_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            Link
                          </a>
                        ) : '-'}
                      </TableCell>
                    )}
                    {visibleColumns.creation_date && <TableCell>{group.creation_date ? format(new Date(group.creation_date), 'PP pp') : '-'}</TableCell>}
                    {visibleColumns.updated_at && <TableCell>{group.updated_at ? format(new Date(group.updated_at), 'PP pp') : '-'}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
            <Button 
              onClick={handleExtract} 
              disabled={selectedGroups.length === 0 || isExtracting}
            >
              {isExtracting ? 'Extracting...' : `Extract Selected (${selectedGroups.length})`}
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
