/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SwipeRowProps {
  rowKey: string;
  swipeOpenKey: string | null;
  onOpenChange: (key: string | null) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  leftSwipeContent?: React.ReactNode;
  rightSwipeContent?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const SwipeRow: React.FC<SwipeRowProps> = ({
  rowKey,
  swipeOpenKey,
  onOpenChange,
  onEdit,
  onDelete,
  leftSwipeContent,
  rightSwipeContent,
  disabled = false,
  className = '',
  style,
  children,
}) => {
  const hasCustomSwipe = Boolean(leftSwipeContent || rightSwipeContent);
  const isOpen = !disabled && swipeOpenKey === rowKey;
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const liveOffsetRef = useRef(0);
  const openedAtRef = useRef(0);

  const updateOffset = (val: number) => {
    liveOffsetRef.current = val;
    setOffsetX(val);
  };

  // Sync state when closed or opened externally
  useEffect(() => {
    if (!isOpen) {
      updateOffset(0);
    } else if (leftSwipeContent && !rightSwipeContent && containerRef.current && liveOffsetRef.current === 0) {
      const target = -Math.round(containerRef.current.offsetWidth * 0.7);
      updateOffset(target);
    }
  }, [isOpen, leftSwipeContent, rightSwipeContent]);

  // Close custom swipe panel on click anywhere on the page
  useEffect(() => {
    if (!isOpen || !hasCustomSwipe) return;
    const handleDocClick = () => {
      if (Date.now() - openedAtRef.current < 120) return;
      updateOffset(0);
      onOpenChange(null);
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [isOpen, hasCustomSwipe, onOpenChange]);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalRef = useRef<boolean | null>(null);
  const hasMovedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Only primary button
    if (e.button !== 0) return;
    e.stopPropagation();

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = liveOffsetRef.current;
    isDraggingRef.current = true;
    isHorizontalRef.current = null;
    hasMovedRef.current = false;
    pointerIdRef.current = e.pointerId;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !isDraggingRef.current || pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect direction on initial movement (min threshold so vertical scroll isn't disrupted)
    if (isHorizontalRef.current === null) {
      const threshold = hasCustomSwipe ? 8 : 5;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (Math.abs(dx) > Math.abs(dy)) {
          if (hasCustomSwipe && currentOffsetRef.current === 0) {
            if ((dx < 0 && !leftSwipeContent) || (dx > 0 && !rightSwipeContent)) {
              isHorizontalRef.current = false;
              isDraggingRef.current = false;
              return;
            }
          }
          isHorizontalRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore if pointer capture fails
          }
          setIsDragging(true);
        } else {
          isHorizontalRef.current = false;
          isDraggingRef.current = false;
          return;
        }
      } else {
        return;
      }
    }

    if (!isHorizontalRef.current) return;

    if (Math.abs(dx) > 6) {
      hasMovedRef.current = true;
    }

    if (hasCustomSwipe) {
      const width = containerRef.current?.offsetWidth || 360;
      const minOffset = leftSwipeContent ? -Math.round(width * 0.7) : 0;
      const maxOffset = rightSwipeContent ? Math.round(width * 0.28) : 0;
      let nextOffset = currentOffsetRef.current + dx;
      if (currentOffsetRef.current < 0) {
        if (nextOffset > 0) nextOffset = 0;
        if (nextOffset < minOffset) nextOffset = minOffset;
      } else if (currentOffsetRef.current > 0) {
        if (nextOffset < 0) nextOffset = 0;
        if (nextOffset > maxOffset) nextOffset = maxOffset;
      } else {
        if (nextOffset < minOffset) nextOffset = minOffset;
        if (nextOffset > maxOffset) nextOffset = maxOffset;
      }
      updateOffset(nextOffset);
    } else {
      // Limit drag to [-72, +72]
      let nextOffset = currentOffsetRef.current + dx;
      if (nextOffset > 72) nextOffset = 72;
      if (nextOffset < -72) nextOffset = -72;
      updateOffset(nextOffset);
    }
  };

  const endDrag = useCallback(
    (e?: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (e && pointerIdRef.current !== null) {
        try {
          e.currentTarget.releasePointerCapture(pointerIdRef.current);
        } catch {
          // ignore
        }
      }
      pointerIdRef.current = null;

      const latestOffset = liveOffsetRef.current;

      if (hasCustomSwipe) {
        const width = containerRef.current?.offsetWidth || 360;
        const leftTarget = -Math.round(width * 0.7);
        const rightTarget = Math.round(width * 0.28);

        if (latestOffset < 0 && leftSwipeContent) {
          const shouldOpenLeft =
            isOpen && currentOffsetRef.current < 0
              ? latestOffset <= leftTarget + 36
              : latestOffset < -Math.min(48, width * 0.15);

          if (shouldOpenLeft) {
            openedAtRef.current = Date.now();
            updateOffset(leftTarget);
            onOpenChange(rowKey);
          } else {
            updateOffset(0);
            if (isOpen) {
              onOpenChange(null);
            }
          }
          return;
        }

        if (latestOffset > 0 && rightSwipeContent) {
          const shouldOpenRight =
            isOpen && currentOffsetRef.current > 0
              ? latestOffset >= rightTarget - 24
              : latestOffset > Math.min(36, width * 0.1);

          if (shouldOpenRight) {
            openedAtRef.current = Date.now();
            updateOffset(rightTarget);
            onOpenChange(rowKey);
          } else {
            updateOffset(0);
            if (isOpen) {
              onOpenChange(null);
            }
          }
          return;
        }

        updateOffset(0);
        if (isOpen) {
          onOpenChange(null);
        }
        return;
      }

      // Determine snap position
      // Swipe Right (offsetX > 0) -> reveals left "حذف" button (64px)
      // Swipe Left (offsetX < 0) -> reveals right "تعديل" button (-64px)
      if (latestOffset > 32) {
        updateOffset(64);
        onOpenChange(rowKey);
      } else if (latestOffset < -32) {
        updateOffset(-64);
        onOpenChange(rowKey);
      } else {
        updateOffset(0);
        if (isOpen) {
          onOpenChange(null);
        }
      }
    },
    [isOpen, rowKey, onOpenChange, hasCustomSwipe, leftSwipeContent, rightSwipeContent]
  );

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (disabled) return;
    // If we moved > 6px, suppress clicks inside
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
      return;
    }

    // If the card was open and clicked, close it and suppress action
    if (isOpen) {
      e.stopPropagation();
      e.preventDefault();
      updateOffset(0);
      onOpenChange(null);
    }
  };

  const showButtons = !disabled && (isDragging || isOpen || offsetX !== 0);
  const showLeftPanel = !disabled && Boolean(leftSwipeContent) && offsetX < 0;
  const showRightPanel = !disabled && Boolean(rightSwipeContent) && offsetX > 0;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className}`}
      style={style}
    >
      {/* Custom left/right swipe background panels */}
      {hasCustomSwipe ? (
        <>
          {leftSwipeContent && (
            <div
              className="absolute inset-0 bg-[#5F2967] rounded-[inherit]"
              style={{
                zIndex: 1,
                visibility: showLeftPanel ? 'visible' : 'hidden',
                opacity: showLeftPanel ? 1 : 0,
                pointerEvents: isOpen && offsetX < 0 ? 'auto' : 'none',
              }}
            >
              {leftSwipeContent}
            </div>
          )}
          {rightSwipeContent && (
            <div
              className="absolute inset-0 bg-[#3B3550] rounded-[inherit]"
              style={{
                zIndex: 1,
                visibility: showRightPanel ? 'visible' : 'hidden',
                opacity: showRightPanel ? 1 : 0,
                pointerEvents: isOpen && offsetX > 0 ? 'auto' : 'none',
              }}
            >
              {rightSwipeContent}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Background action button: "حذف" on LEFT edge (revealed when dragging right > 0) */}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateOffset(0);
                onOpenChange(null);
                onDelete();
              }}
              className="absolute left-0 top-0 bottom-0 w-[64px] bg-[#C0394F] text-white font-[700] text-[10px] flex items-center justify-center cursor-pointer transition hover:bg-[#A93245] active:scale-95 rounded-[inherit]"
              style={{
                zIndex: 1,
                visibility: showButtons ? 'visible' : 'hidden',
                opacity: showButtons ? 1 : 0,
                pointerEvents: isOpen && offsetX > 0 ? 'auto' : 'none',
              }}
            >
              حذف
            </button>
          )}

          {/* Background action button: "تعديل" on RIGHT edge (revealed when dragging left < 0) */}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateOffset(0);
                onOpenChange(null);
                onEdit();
              }}
              className="absolute right-0 top-0 bottom-0 w-[64px] bg-[#5F2967] text-white font-[700] text-[10px] flex items-center justify-center cursor-pointer transition hover:bg-[#4E2155] active:scale-95 rounded-[inherit]"
              style={{
                zIndex: 1,
                visibility: showButtons ? 'visible' : 'hidden',
                opacity: showButtons ? 1 : 0,
                pointerEvents: isOpen && offsetX < 0 ? 'auto' : 'none',
              }}
            >
              تعديل
            </button>
          )}
        </>
      )}

      {/* Foreground draggable card */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
        style={{
          transform: disabled ? undefined : `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 180ms ease-out',
          touchAction: 'pan-y',
          position: 'relative',
          zIndex: 2,
        }}
        className="w-full h-full rounded-[inherit]"
      >
        {children}
      </div>
    </div>
  );
};
