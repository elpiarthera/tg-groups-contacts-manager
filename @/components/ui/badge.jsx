import * as React from "react"

export const Badge = ({ children, variant = "default" }) => {
  const variants = {
    default: "bg-gray-200 text-gray-800",
    success: "bg-green-200 text-green-800",
    error: "bg-red-200 text-red-800",
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded ${variants[variant]}`}>
      {children}
    </span>
  )
}
