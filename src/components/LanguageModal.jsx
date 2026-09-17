import React from 'react';
import { X, Check } from 'lucide-react';
import { LANGUAGES } from '../utils/translations';
import { triggerHaptic } from '../services/telegram';

export default function LanguageModal({ isOpen, onClose, currentLang, onSelectLang }) {
  if (!isOpen) return null;

  const handleSelect = (code) => {
    triggerHaptic('selection');
    onSelectLang(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      {/* 3D Dark Language Card */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1c1c24 0%, #121218 100%)',
          borderTop: '2px solid #3c3c4e',
          borderLeft: '1.5px solid #282836',
          borderRight: '1.5px solid #282836',
          borderBottom: '5px solid #0a0a0e',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(247, 191, 70, 0.15)'
        }}
        className="w-full max-w-md rounded-[32px] p-5 relative my-auto max-h-[88vh] overflow-y-auto custom-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-[#282838]">
          <h3 className="text-base font-heading font-black text-white tracking-wide">
            Select Language
          </h3>
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white bg-[#0e0e14] border border-[#2d2d3e] active:scale-90 transition-all"
          >
            <X size={17} />
          </button>
        </div>

        {/* 2-Column Grid of 20 Languages (Matched to Screenshot) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;

            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                style={
                  isSelected
                    ? {
                        background: 'linear-gradient(180deg, #382e18 0%, #241c0c 100%)',
                        borderTop: '1.5px solid #f7bf46',
                        borderLeft: '1px solid #d48b11',
                        borderRight: '1px solid #d48b11',
                        borderBottom: '3px solid #140d04',
                        boxShadow: '0 4px 12px rgba(247, 191, 70, 0.25)'
                      }
                    : {
                        background: '#15151c',
                        borderTop: '1px solid #282836',
                        borderLeft: '1px solid #1f1f2a',
                        borderRight: '1px solid #1f1f2a',
                        borderBottom: '2.5px solid #0a0a0e'
                      }
                }
                className="p-2.5 rounded-2xl flex items-center justify-between transition-all active:scale-95 group hover:border-[#f7bf46]/50"
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-1">
                  <span className="text-lg leading-none shrink-0 drop-shadow-sm">
                    {lang.flag}
                  </span>
                  <span
                    className={`text-xs font-black truncate tracking-wide ${
                      isSelected ? 'text-yellow-400' : 'text-gray-200 group-hover:text-white'
                    }`}
                  >
                    {lang.name}
                  </span>
                </div>

                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-black shrink-0 shadow-sm">
                    <Check size={11} strokeWidth={3.5} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
