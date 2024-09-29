'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from 'date-fns'

export default function GroupsList() {
  const [groups, setGroups] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchGroups()
  }, [page])

  const fetchGroups = async () => {
    setIsLoading(true)
    const credentials = JSON.parse(localStorage.getItem('telegramCredentials'))
    
    try {
      const response = await fetch('/api/fetch-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          extractType: 'groups',
          page,
          pageSize: 50,
          userId: 'tempUserId', // Replace with actual user ID when auth is implemented
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch groups')
      }

      const data = await response.json()
      setGroups(prevGroups => [...prevGroups, ...data.extractedData])
      setTotalCount(data.totalCount)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching groups:', error)
      // Handle error (e.g., show error message to user)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectedGroups(selectAll ? [] : groups.map(group => group.group_id))
  }

  const handleSelectGroup = (groupId) => {
    setSelectedGroups(prevSelected =>
      prevSelected.includes(groupId)
        ? prevSelected.filter(id => id !== groupId)
        : [...prevSelected, groupId]
    )
  }

  const handleLoadMore = () => {
    if (hasMore) {
      setPage(prevPage => prevPage + 1)
    }
  }

  const handleExtract = async () => {
    const selectedData = groups.filter(group => selectedGroups.includes(group.group_id))
    const credentials = JSON.parse(localStorage.getItem('telegramCredentials'))

    try {
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          extractType: 'groups',
          selectedIds: selectedGroups,
          userId: 'tempUserId', // Replace with actual user ID when auth is implemented
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to extract data')
      }

      const data = await response.json()
      // Trigger CSV download
      const blob = new Blob([data.csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'extracted_groups.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error extracting data:', error)
      // Handle error (e.g., show error message to user)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Groups List</h2>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {selectAll ? "Unselect All" : "Select All"}
          </label>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Select</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Admin Rights</TableHead>
              <TableHead>Banned Rights</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.group_id}>
                <TableCell>
                  <Checkbox
                    checked={selectedGroups.includes(group.group_id)}
                    onCheckedChange={() => handleSelectGroup(group.group_id)}
                  />
                </TableCell>
                <TableCell>{group.group_name}</TableCell>
                <TableCell>{group.group_url}</TableCell>
                <TableCell>{group.description}</TableCell>
                <TableCell>{group.participant_count}</TableCell>
                <TableCell>{format(new Date(group.creation_date), 'PP')}</TableCell>
                <TableCell>{JSON.stringify(group.admin_rights)}</TableCell>
                <TableCell>{JSON.stringify(group.banned_rights)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <Button onClick={handleLoadMore} className="mt-4">
          Load More
        </Button>
      )}
      <Button onClick={handleExtract} className="mt-4 ml-4" disabled={selectedGroups.length === 0}>
        Extract Selected Groups
      </Button>
      <p className="mt-2">Total Groups: {totalCount}</p>
    </div>
  )
}