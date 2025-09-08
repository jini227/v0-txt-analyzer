"use client"

import type React from "react"

import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useState } from "react"

interface ChipsProps {
  items: string[]
  onRemove: (item: string) => void
  onAdd?: (item: string) => void
  addable?: boolean
  className?: string
}

export function Chips({ items, onRemove, onAdd, addable = false, className }: ChipsProps) {
  const [newItem, setNewItem] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = () => {
    if (newItem.trim() && onAdd) {
      onAdd(newItem.trim())
      setNewItem("")
      setIsAdding(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd()
    } else if (e.key === "Escape") {
      setNewItem("")
      setIsAdding(false)
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="flex items-center gap-1 px-3 py-1">
          <span>{item}</span>
          <button
            onClick={() => onRemove(item)}
            className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {addable && (
        <>
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={() => {
                  if (!newItem.trim()) setIsAdding(false)
                }}
                placeholder="화자 이름"
                className="h-8 w-24"
                autoFocus
              />
              <Button size="sm" onClick={handleAdd} disabled={!newItem.trim()}>
                추가
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} className="h-8 px-3">
              <Plus className="h-3 w-3 mr-1" />
              화자 추가
            </Button>
          )}
        </>
      )}
    </div>
  )
}
