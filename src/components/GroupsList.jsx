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

  useEffect(() => {
    const fetchGroups = async () => {
      const credentials = JSON.parse(localStorage.getItem('telegramCredentials'))
      
      try {
        const response = await fetch('/api/fetch-groups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch groups')
        }

        const data = await response.json()
        setGroups(data)
      } catch (error) {
        console.error('Error fetching groups:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroups()
  }, [])

  const handleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectedGroups(selectAll ? [] : groups.map(group => group.id))
  }

  const handleSelectGroup = (groupId) => {
    setSelectedGroups(prevSelected =>
      prevSelected.includes(groupId)
        ? prevSelected.filter(id => id !== groupId)
        : [...prevSelected, groupId]
    )
  }

  const handleExtract = async () => {
    try {
      const response = await fetch('/api/extract-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedGroups }),
      })

      if (!response.ok) {
        throw new Error('Failed to extract groups')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'extracted_groups.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error extracting groups:', error)
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Groups List</h2>
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
      <Button onClick={handleExtract} disabled={selectedGroups.length === 0}>Extract Selected Groups</Button>
    </div>
  )
}