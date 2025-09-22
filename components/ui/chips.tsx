"use client"

import type React from "react";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ChipsProps {
  items: string[];
  onRemove: (item: string) => void;
  /**
   * 추가 시 true(또는 void) => 입력창 닫고 초기화
   * false => 입력창/값 유지 (유효성 실패 등)
   */
  onAdd?: (item: string) => void | boolean | Promise<void | boolean>;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finishAdd = (ok: boolean) => {
    if (ok) {
      setNewItem("");
      setIsAdding(false);
    } else {
      // 실패 시 입력 유지 + 포커스 유지
      setIsAdding(true);
    }
  };

  const handleAdd = async () => {
    const val = newItem.trim();
    if (!val || !onAdd) return;

    try {
      setIsSubmitting(true);
      const res = await Promise.resolve(onAdd(val));
      // onAdd가 값을 반환하지 않으면 성공(true)로 간주
      const ok = typeof res === "boolean" ? res : true;
      finishAdd(ok);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      await handleAdd();
    } else if (e.key === "Escape") {
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
            style={color ? { borderColor: color } : undefined}
          >
            {/* {color && (
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden
              />
            )} */}
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
                // 입력 유지가 목적이라 onBlur로 자동닫기 제거
                placeholder="화자 이름"
                className="h-8 w-28 sm:w-36"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newItem.trim() || isSubmitting}
              >
                추가
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewItem("");
                  setIsAdding(false);
                }}
              >
                취소
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
