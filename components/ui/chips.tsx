"use client";

import type React from "react";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ChipsProps {
  items: string[];
  onRemove: (item: string) => void;
  onAdd?: (item: string) => void;
  addable?: boolean;
  className?: string;
  /** 라벨별 색상을 반환하면 칩 왼쪽에 색 점을 렌더링합니다. */
  getColor?: (label: string) => string;
}

export function Chips({
  items,
  onRemove,
  onAdd,
  addable = false,
  className,
  getColor,
}: ChipsProps) {
  const [newItem, setNewItem] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!onAdd) return;
    const val = newItem.trim();
    if (val) {
      onAdd(val);
      setNewItem("");
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
    else if (e.key === "Escape") {
      setNewItem("");
      setIsAdding(false);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {items.map((item) => {
        const color = getColor ? getColor(item) : undefined;
        return (
          <Badge
            key={item}
            variant="secondary"
            className="flex items-center gap-2 px-3 py-1"
            title={item}
          >
            {/* 색 점 */}
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={color ? { backgroundColor: color } : undefined}
              aria-hidden
            />
            <span className="truncate max-w-[10rem]">{item}</span>
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
              aria-label={`${item} 제거`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {addable && (
        <>
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={() => {
                  if (!newItem.trim()) setIsAdding(false);
                }}
                placeholder="화자 이름"
                className="h-8 w-28"
                autoFocus
              />
              <Button size="sm" onClick={handleAdd} disabled={!newItem.trim()}>
                추가
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="h-8 px-3"
            >
              <Plus className="h-3 w-3 mr-1" />
              화자 추가
            </Button>
          )}
        </>
      )}
    </div>
  );
}
