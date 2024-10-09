import React from 'react';
import { Button } from "@/components/ui/button";

export function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex justify-center items-center space-x-2 mt-4">
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        variant="outline"
      >
        Previous
      </Button>
      <span className="text-sm">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}
