import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface DesmosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesmosModal: React.FC<DesmosModalProps> = ({ isOpen, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 36, y: 64 });
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const width = isExpanded ? 720 : 400;
  const height = isExpanded ? 640 : 580;

  useEffect(() => {
    if (!dragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const nextX = e.clientX - dragOffsetRef.current.x;
      const nextY = e.clientY - dragOffsetRef.current.y;
      const maxX = Math.max(0, window.innerWidth - 80);
      const maxY = Math.max(0, window.innerHeight - 48);

      setPosition({
        x: Math.max(-width + 80, Math.min(maxX, nextX)),
        y: Math.max(0, Math.min(maxY, nextY)),
      });
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const nextX = touch.clientX - dragOffsetRef.current.x;
      const nextY = touch.clientY - dragOffsetRef.current.y;
      const maxX = Math.max(0, window.innerWidth - 80);
      const maxY = Math.max(0, window.innerHeight - 48);

      setPosition({
        x: Math.max(-width + 80, Math.min(maxX, nextX)),
        y: Math.max(0, Math.min(maxY, nextY)),
      });
    };

    const handleStopDrag = () => {
      setDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleStopDrag);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleStopDrag);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleStopDrag);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleStopDrag);
    };
  }, [dragging, width]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Do not start drag if clicking a button inside header
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    dragOffsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
    setDragging(true);
  };

  return (
    <div
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      className={`fixed z-50 bg-[#1e1e1e] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-[#333333] flex flex-col overflow-hidden select-none ${
        isOpen ? '' : 'hidden'
      }`}
    >
      {/* Top Draggable Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`flex items-center justify-between px-4 py-2.5 bg-[#1e1e1e] border-b border-[#2e2e2e] text-white ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <span className="text-[14px] font-bold tracking-tight text-white">
          Graphing Calculator
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Kichraytirish' : 'Kattalashtirish'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desmos Calculator Body */}
      <div className="flex-1 w-full h-full bg-white relative">
        {/* Transparent shield while dragging so the iframe never captures pointer events */}
        {dragging && <div className="absolute inset-0 z-20 cursor-grabbing" />}
        <iframe
          src="https://www.desmos.com/calculator"
          title="Desmos Graphing Calculator"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
};
