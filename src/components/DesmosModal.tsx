import React, { useState } from 'react';
import { GripHorizontal, Maximize2, Minimize2, X, Plus, Trash2 } from 'lucide-react';

interface DesmosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesmosModal: React.FC<DesmosModalProps> = ({ isOpen, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'desmos' | 'builtin'>('desmos');
  const [expressions, setExpressions] = useState<string[]>(['180*(35-2)', 'x + 4y = 19']);
  const [position, setPosition] = useState({ x: 320, y: 72 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isExpanded) return;
    setDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || isExpanded) return;
    setPosition({
      x: Math.max(16, Math.min(window.innerWidth - 420, e.clientX - dragOffset.x)),
      y: Math.max(48, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y)),
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const evalMathExpression = (expr: string): string => {
    try {
      const cleaned = expr
        .replace(/\^/g, '**')
        .replace(/π/g, 'Math.PI')
        .replace(/sqrt\(/gi, 'Math.sqrt(')
        .replace(/sin\(/gi, 'Math.sin(')
        .replace(/cos\(/gi, 'Math.cos(')
        .replace(/tan\(/gi, 'Math.tan(');
      if (/[^0-9+\-*/().\sMathPIsqrtincota*]/.test(cleaned)) {
        return '';
      }
      // eslint-disable-next-line no-new-func
      const res = Function(`"use strict"; return (${cleaned})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return Number(res.toFixed(6)).toString();
      }
      return '';
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        style={
          isExpanded
            ? { top: '64px', left: '5%', width: '90%', height: '82vh' }
            : { top: `${position.y}px`, left: `${position.x}px`, width: '540px', height: '640px' }
        }
        className="fixed pointer-events-auto bg-white rounded-xl shadow-2xl border border-gray-300 flex flex-col overflow-hidden"
      >
        {/* Top Draggable Bar */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-gray-200 cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <GripHorizontal className="w-4 h-4 text-gray-400" />
            <span>Graphing Calculator (Desmos)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMode(mode === 'desmos' ? 'builtin' : 'desmos')}
              className="px-2 py-0.5 text-[11px] font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              title="Switch calculator mode"
            >
              {mode === 'desmos' ? 'Quick Calc' : 'Desmos Graph'}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title={isExpanded ? 'Restore size' : 'Expand calculator'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title="Close calculator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subheader matching Desmos dark bar */}
        <div className="bg-[#222222] text-white px-3.5 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-200">Untitled Graph</span>
            <span className="px-2 py-0.5 rounded bg-[#3a3a3a] text-gray-400 text-[11px]">Save</span>
          </div>
          <span className="text-[11px] text-gray-400">College Board Testing Mode</span>
        </div>

        {mode === 'desmos' ? (
          <div className="flex-1 w-full h-full bg-white relative">
            <iframe
              src="https://www.desmos.com/calculator"
              title="Desmos Graphing Calculator"
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          <div className="flex-1 flex divide-x divide-gray-200 overflow-hidden">
            {/* Left Expression List */}
            <div className="w-1/2 flex flex-col bg-white">
              <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <button
                  onClick={() => setExpressions([...expressions, ''])}
                  className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-black px-2 py-1 rounded hover:bg-gray-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Expression
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
                {expressions.map((expr, i) => {
                  const result = evalMathExpression(expr);
                  return (
                    <div key={i} className="flex items-stretch">
                      <div className="w-7 bg-blue-600/10 border-r border-gray-200 flex items-start justify-center pt-2 text-[11px] font-mono text-blue-700 font-semibold">
                        {i + 1}
                      </div>
                      <div className="flex-1 p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={expr}
                            onChange={(e) => {
                              const next = [...expressions];
                              next[i] = e.target.value;
                              setExpressions(next);
                            }}
                            placeholder="Type math expression (e.g. 180*(35-2))"
                            className="w-full text-sm font-mono focus:outline-none text-gray-900"
                          />
                          <button
                            onClick={() => setExpressions(expressions.filter((_, idx) => idx !== i))}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {result !== '' && (
                          <div className="text-right text-xs font-mono font-bold text-[#1b4332] bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                            = {result}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Coordinate Grid Preview */}
            <div className="w-1/2 bg-white relative flex items-center justify-center overflow-hidden">
              <svg viewBox="-100 -100 200 200" className="w-full h-full">
                <defs>
                  <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f1f5f9" strokeWidth="0.6" />
                  </pattern>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <rect width="50" height="50" fill="url(#smallGrid)" />
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.9" />
                  </pattern>
                </defs>
                <rect x="-100" y="-100" width="200" height="200" fill="url(#grid)" />
                <line x1="-100" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="1.2" />
                <line x1="0" y1="-100" x2="0" y2="100" stroke="#334155" strokeWidth="1.2" />
                <text x="45" y="10" fontSize="6" fill="#475569">10</text>
                <text x="-55" y="10" fontSize="6" fill="#475569">-10</text>
                <text x="4" y="-46" fontSize="6" fill="#475569">10</text>
                <text x="4" y="52" fontSize="6" fill="#475569">-10</text>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
