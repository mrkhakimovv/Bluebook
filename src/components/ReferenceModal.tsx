import React from 'react';
import { BookOpen, X } from 'lucide-react';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferenceModal: React.FC<ReferenceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88%] overflow-y-auto border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#1e3a5f]" />
            <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight">Reference Sheet</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[#1e3a5f]/40 flex items-center justify-center text-[#1e3a5f] hover:bg-gray-100 transition-colors"
            title="Close Reference Sheet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-7 space-y-4 sm:space-y-5">
          {/* Row 1: 6 2D Geometry Cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3.5">
            {/* 1. Circle */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 100 90" className="w-24 h-20">
                <circle cx="50" cy="45" r="30" fill="none" stroke="#111" strokeWidth="1.6" />
                <circle cx="50" cy="45" r="2" fill="#111" />
                <line x1="50" y1="45" x2="80" y2="45" stroke="#111" strokeWidth="1.5" />
                <text x="63" y="40" fontSize="11" fontStyle="italic" fontFamily="serif">r</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 space-y-1 leading-tight">
                <div>A = πr²</div>
                <div>C = 2πr</div>
              </div>
            </div>

            {/* 2. Rectangle */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 110 90" className="w-24 h-20">
                <rect x="18" y="22" width="66" height="44" fill="none" stroke="#111" strokeWidth="1.6" />
                <text x="48" y="79" fontSize="11" fontStyle="italic" fontFamily="serif">ℓ</text>
                <text x="89" y="48" fontSize="11" fontStyle="italic" fontFamily="serif">w</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                A = ℓw
              </div>
            </div>

            {/* 3. Triangle */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 110 90" className="w-24 h-20">
                <polygon points="18,68 52,18 90,68" fill="none" stroke="#111" strokeWidth="1.6" />
                <line x1="52" y1="18" x2="52" y2="68" stroke="#111" strokeWidth="1.3" strokeDasharray="3,3" />
                <rect x="52" y="61" width="7" height="7" fill="none" stroke="#111" strokeWidth="1.2" />
                <text x="56" y="48" fontSize="11" fontStyle="italic" fontFamily="serif">h</text>
                <text x="50" y="81" fontSize="11" fontStyle="italic" fontFamily="serif">b</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                A = ½bh
              </div>
            </div>

            {/* 4. Right Triangle (Pythagorean) */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 110 90" className="w-24 h-20">
                <polygon points="24,20 24,68 88,68" fill="none" stroke="#111" strokeWidth="1.6" />
                <rect x="24" y="60" width="8" height="8" fill="none" stroke="#111" strokeWidth="1.2" />
                <text x="13" y="48" fontSize="11" fontStyle="italic" fontFamily="serif">a</text>
                <text x="53" y="81" fontSize="11" fontStyle="italic" fontFamily="serif">b</text>
                <text x="58" y="40" fontSize="11" fontStyle="italic" fontFamily="serif">c</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                c² = a² + b²
              </div>
            </div>

            {/* 5. 30-60-90 Special Right Triangle */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-center min-h-[160px] bg-white">
              <svg viewBox="0 0 120 95" className="w-28 h-24">
                <polygon points="16,68 92,68 92,24" fill="none" stroke="#111" strokeWidth="1.6" />
                <rect x="84" y="60" width="8" height="8" fill="none" stroke="#111" strokeWidth="1.2" />
                <text x="31" y="64" fontSize="9" fontFamily="sans-serif">30°</text>
                <text x="74" y="41" fontSize="9" fontFamily="sans-serif">60°</text>
                <text x="45" y="40" fontSize="11" fontStyle="italic" fontFamily="serif">2x</text>
                <text x="97" y="50" fontSize="11" fontStyle="italic" fontFamily="serif">x</text>
                <text x="48" y="82" fontSize="11" fontStyle="italic" fontFamily="serif">x√3</text>
              </svg>
            </div>

            {/* 6. 45-45-90 Special Right Triangle */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-center min-h-[160px] bg-white">
              <svg viewBox="0 0 115 95" className="w-28 h-24">
                <polygon points="26,18 26,68 78,68" fill="none" stroke="#111" strokeWidth="1.6" />
                <rect x="26" y="60" width="8" height="8" fill="none" stroke="#111" strokeWidth="1.2" />
                <text x="29" y="34" fontSize="9" fontFamily="sans-serif">45°</text>
                <text x="58" y="64" fontSize="9" fontFamily="sans-serif">45°</text>
                <text x="15" y="47" fontSize="11" fontStyle="italic" fontFamily="serif">s</text>
                <text x="50" y="82" fontSize="11" fontStyle="italic" fontFamily="serif">s</text>
                <text x="56" y="38" fontSize="11" fontStyle="italic" fontFamily="serif">s√2</text>
              </svg>
            </div>
          </div>

          {/* Row 2: 5 3D Volume Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
            {/* 7. Rectangular Solid */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 120 90" className="w-24 h-20">
                <rect x="18" y="32" width="56" height="36" fill="none" stroke="#111" strokeWidth="1.5" />
                <polyline points="18,32 36,18 92,18 92,54 74,68" fill="none" stroke="#111" strokeWidth="1.5" />
                <line x1="74" y1="32" x2="92" y2="18" stroke="#111" strokeWidth="1.5" />
                <text x="9" y="53" fontSize="11" fontStyle="italic" fontFamily="serif">h</text>
                <text x="44" y="80" fontSize="11" fontStyle="italic" fontFamily="serif">ℓ</text>
                <text x="86" y="67" fontSize="11" fontStyle="italic" fontFamily="serif">w</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                V = ℓwh
              </div>
            </div>

            {/* 8. Cylinder */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 110 90" className="w-24 h-20">
                <ellipse cx="50" cy="24" rx="26" ry="8" fill="none" stroke="#111" strokeWidth="1.5" />
                <line x1="24" y1="24" x2="24" y2="64" stroke="#111" strokeWidth="1.5" />
                <line x1="76" y1="24" x2="76" y2="64" stroke="#111" strokeWidth="1.5" />
                <path d="M24,64 A26,8 0 0,0 76,64" fill="none" stroke="#111" strokeWidth="1.5" />
                <line x1="50" y1="24" x2="76" y2="24" stroke="#111" strokeWidth="1.3" />
                <circle cx="50" cy="24" r="1.8" fill="#111" />
                <text x="61" y="21" fontSize="11" fontStyle="italic" fontFamily="serif">r</text>
                <text x="82" y="47" fontSize="11" fontStyle="italic" fontFamily="serif">h</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                V = πr²h
              </div>
            </div>

            {/* 9. Sphere */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 110 90" className="w-24 h-20">
                <circle cx="55" cy="45" r="27" fill="none" stroke="#111" strokeWidth="1.5" />
                <ellipse cx="55" cy="45" rx="27" ry="8" fill="none" stroke="#111" strokeWidth="1.2" strokeDasharray="3,2" />
                <circle cx="55" cy="45" r="1.8" fill="#111" />
                <line x1="55" y1="45" x2="76" y2="30" stroke="#111" strokeWidth="1.3" />
                <text x="63" y="34" fontSize="11" fontStyle="italic" fontFamily="serif">r</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                V = (4/3)πr³
              </div>
            </div>

            {/* 10. Cone */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 110 90" className="w-24 h-20">
                <ellipse cx="55" cy="65" rx="25" ry="8" fill="none" stroke="#111" strokeWidth="1.4" />
                <line x1="30" y1="65" x2="55" y2="18" stroke="#111" strokeWidth="1.5" />
                <line x1="80" y1="65" x2="55" y2="18" stroke="#111" strokeWidth="1.5" />
                <line x1="55" y1="18" x2="55" y2="65" stroke="#111" strokeWidth="1.2" strokeDasharray="3,3" />
                <line x1="55" y1="65" x2="80" y2="65" stroke="#111" strokeWidth="1.3" />
                <text x="46" y="46" fontSize="11" fontStyle="italic" fontFamily="serif">h</text>
                <text x="65" y="63" fontSize="11" fontStyle="italic" fontFamily="serif">r</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                V = (1/3)πr²h
              </div>
            </div>

            {/* 11. Pyramid */}
            <div className="border border-gray-200 rounded-xl p-3.5 flex flex-col items-center justify-between min-h-[160px] bg-white">
              <svg viewBox="0 0 120 90" className="w-24 h-20">
                <polygon points="20,68 68,68 92,52 44,52" fill="none" stroke="#111" strokeWidth="1.3" strokeDasharray="2,2" />
                <polyline points="20,68 68,68 92,52" fill="none" stroke="#111" strokeWidth="1.5" />
                <line x1="56" y1="16" x2="20" y2="68" stroke="#111" strokeWidth="1.5" />
                <line x1="56" y1="16" x2="68" y2="68" stroke="#111" strokeWidth="1.5" />
                <line x1="56" y1="16" x2="92" y2="52" stroke="#111" strokeWidth="1.5" />
                <line x1="56" y1="16" x2="56" y2="60" stroke="#111" strokeWidth="1.2" strokeDasharray="3,3" />
                <text x="58" y="44" fontSize="11" fontStyle="italic" fontFamily="serif">h</text>
                <text x="43" y="80" fontSize="11" fontStyle="italic" fontFamily="serif">ℓ</text>
                <text x="84" y="66" fontSize="11" fontStyle="italic" fontFamily="serif">w</text>
              </svg>
              <div className="text-center font-mono text-xs text-gray-800 leading-tight pb-2">
                V = (1/3)ℓwh
              </div>
            </div>
          </div>

          {/* Bottom Facts Box */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 text-sm text-gray-800 space-y-1.5">
            <p>The number of degrees of arc in a circle is 360.</p>
            <p>The number of radians of arc in a circle is 2π.</p>
            <p>The sum of the measures in degrees of the angles of a triangle is 180.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
