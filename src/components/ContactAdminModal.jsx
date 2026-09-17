import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, Megaphone, CheckCircle2 } from 'lucide-react';
import { openTelegramLink } from '../services/telegram';

export default function ContactAdminModal() {
  const { contactAdminModalOpen, setContactAdminModalOpen } = useApp();

  if (!contactAdminModalOpen) return null;

  const handleContactAdmin = () => {
    openTelegramLink('https://t.me/AppDeveloper99');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="box-3d-gold max-w-sm w-full p-6 text-center relative my-auto">
        <button
          onClick={() => setContactAdminModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full btn-3d-dark text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="w-14 h-14 mx-auto btn-3d-gold rounded-2xl flex items-center justify-center text-black mb-4">
          <Megaphone size={28} />
        </div>

        <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Add Your Own Task</h3>
        
        <p className="text-xs text-gray-300 mb-4 leading-relaxed font-medium">
          Want to promote your Telegram Channel, Group, Bot or Website to thousands of real active hunters?
        </p>

        <div className="badge-3d p-4 mb-5 text-left space-y-2.5">
          <div className="flex items-center space-x-2 text-xs text-yellow-400 font-bold">
            <CheckCircle2 size={15} />
            <span>Guaranteed real user engagements</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-yellow-400 font-bold">
            <CheckCircle2 size={15} />
            <span>Custom Diamond reward settings</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-yellow-400 font-bold">
            <CheckCircle2 size={15} />
            <span>Server-side verification system</span>
          </div>
        </div>

        <button
          onClick={handleContactAdmin}
          className="w-full btn-3d-gold py-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2"
        >
          <Send size={16} />
          <span>Contact Admin to List Task</span>
        </button>

        <p className="text-[11px] text-gray-400 mt-3 font-mono font-bold">Official Telegram: @AppDeveloper99</p>
      </div>
    </div>
  );
}
