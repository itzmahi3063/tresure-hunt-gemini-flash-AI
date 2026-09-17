import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Edit3
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import api from '../services/api';

export default function CreateExclusiveTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  onTaskUpdated,
  editTask = null
}) {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState('website');
  const [verificationType, setVerificationType] = useState('unverified'); // 'unverified' | 'verified'
  const [chatId, setChatId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Admin verification state for TG Bot-verified channels/groups
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminVerifyMessage, setAdminVerifyMessage] = useState(null);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title || '');
      setLink(editTask.link || '');
      setType(editTask.type || 'website');
      setVerificationType(editTask.verification_type || 'unverified');
      setChatId(editTask.chat_id || '');
      setDescription(editTask.description || '');
      setQuantity(editTask.max_users || 100);
      setAdminVerified(!!editTask.chat_id || editTask.verification_type === 'unverified');
    } else {
      setTitle('');
      setLink('');
      setType('website');
      setVerificationType('unverified');
      setChatId('');
      setDescription('');
      setQuantity(100);
      setAdminVerified(false);
    }
    setError(null);
    setAdminVerifyMessage(null);
  }, [editTask, isOpen]);

  // If verification type changes, ensure valid category selection
  const handleVerificationTypeChange = (newType) => {
    setVerificationType(newType);
    setAdminVerified(false);
    setAdminVerifyMessage(null);
    setError(null);
    if (newType === 'verified') {
      if (type !== 'channel' && type !== 'group') {
        setType('channel');
      }
    }
    triggerHaptic('selection');
  };

  if (!isOpen) return null;

  // Rate: Unverified = 0.10 TON / 100 users; Verified (Bot admin checked) = 0.20 TON / 100 users
  const ratePer100 = verificationType === 'verified' ? 0.20 : 0.10;
  const tonCost = Number(((quantity / 100) * ratePer100).toFixed(2));
  const quickQuantities = [100, 200, 500, 1000, 2000];

  const handleQuantityChange = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 100;
    if (num < 100) num = 100;
    if (num > 2000) num = 2000;
    num = Math.round(num / 100) * 100;
    setQuantity(num);
    triggerHaptic('selection');
  };

  const handleVerifyBotAdmin = async () => {
    const cleanLink = link.trim();
    if (!cleanLink) {
      setError('Please enter your Telegram Channel/Group link or @username first');
      return;
    }

    setIsVerifyingAdmin(true);
    setError(null);
    setAdminVerifyMessage(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/tasks/verify-bot-admin', { usernameOrLink: cleanLink });
      if (res.data.success) {
        setAdminVerified(true);
        setChatId(res.data.chatId);
        setAdminVerifyMessage(res.data.message || 'Bot confirmed as Admin!');
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      setAdminVerified(false);
      setError(
        err.response?.data?.error ||
        'Bot is not an Admin! Please add our Bot to your Channel/Group as Admin and try again.'
      );
      triggerHaptic('notification', 'error');
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanLink = link.trim();

    if (!cleanTitle) {
      setError('Please enter a task title');
      return;
    }
    if (!cleanLink || (!cleanLink.startsWith('http://') && !cleanLink.startsWith('https://') && !cleanLink.startsWith('t.me/') && !cleanLink.startsWith('@'))) {
      setError('Please enter a valid URL or Telegram link (e.g. https://t.me/yourchannel or @yourchannel)');
      return;
    }

    if (verificationType === 'verified') {
      if (!adminVerified) {
        setError('Please verify that the Bot is Admin in your Channel/Group before proceeding.');
        return;
      }
    }

    setLoading(true);
    triggerHaptic('impact', 'medium');

    try {
      if (editTask) {
        // Edit existing unpaid draft
        const res = await api.put(`/tasks/exclusive/${editTask.id}`, {
          title: cleanTitle,
          link: cleanLink,
          type,
          verification_type: verificationType,
          chat_id: chatId.trim() || cleanLink,
          description: description.trim() || `Complete visit to earn 10 GEMS (${quantity} hunters campaign)`,
          quantity
        });

        if (res.data.success) {
          triggerHaptic('notification', 'success');
          if (onTaskUpdated) onTaskUpdated(res.data.task);
          onClose();
        }
      } else {
        // Create new draft
        const res = await api.post('/tasks/exclusive/create', {
          title: cleanTitle,
          link: cleanLink,
          type,
          verification_type: verificationType,
          chat_id: chatId.trim() || (verificationType === 'verified' ? cleanLink : ''),
          description: description.trim() || `Complete visit to earn 10 GEMS (${quantity} hunters campaign)`,
          quantity
        });

        if (res.data.success) {
          triggerHaptic('notification', 'success');
          if (onTaskCreated) onTaskCreated(res.data.task);
          onClose();
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save task campaign');
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        style={{
          background: 'linear-gradient(180deg, #2b1c10 0%, #1a1008 100%)',
          borderTop: '2px solid #825429',
          borderLeft: '1.5px solid #4a341f',
          borderRight: '1.5px solid #4a341f',
          borderBottom: '5px solid #0f0904',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(247, 191, 70, 0.15)'
        }}
        className="w-full max-w-md rounded-[32px] p-4 sm:p-5 pb-8 relative my-auto max-h-[88vh] overflow-y-auto custom-scrollbar"
      >
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#a89782] hover:text-white bg-[#140c06] border border-[#4a341f] active:scale-90 transition-all"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div
            style={{
              background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
              borderTop: '1.5px solid #fff2b8',
              borderBottom: '3px solid #7a4b00',
              boxShadow: '0 4px 12px rgba(247, 191, 70, 0.3)'
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#1a0f02] shrink-0"
          >
            {editTask ? <Edit3 size={24} /> : <Sparkles size={24} />}
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide">
              {editTask ? 'Edit Task Campaign' : 'Create Exclusive Task'}
            </h3>
            <p className="text-xs text-[#a89782] font-medium">
              {editTask ? 'Modify your post before completing payment' : 'Reach real hunters in our community'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-[#2e1313] border border-[#632929] text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Verification Mode Selector */}
          <div>
            <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider block mb-1.5">
              Task Verification Type & Pricing
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Unverified Plan */}
              <button
                type="button"
                onClick={() => handleVerificationTypeChange('unverified')}
                style={
                  verificationType === 'unverified'
                    ? {
                        background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                        borderTop: '1.5px solid #ffdc7a',
                        borderBottom: '3px solid #1c1007',
                        color: '#f7bf46',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                      }
                    : {
                        backgroundColor: '#160e07',
                        border: '1px solid #382413',
                        color: '#a89782'
                      }
                }
                className="p-2.5 rounded-2xl text-left transition-all active:scale-95"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black">Quick Task</span>
                  <span className="text-[10px] font-mono font-black text-cyan-400">0.10 TON</span>
                </div>
                <p className="text-[10px] opacity-75 mt-0.5 leading-tight">
                  Website / any link. 1-tap fast verify.
                </p>
              </button>

              {/* Bot-Verified Plan */}
              <button
                type="button"
                onClick={() => handleVerificationTypeChange('verified')}
                style={
                  verificationType === 'verified'
                    ? {
                        background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                        borderTop: '1.5px solid #ffdc7a',
                        borderBottom: '3px solid #1c1007',
                        color: '#f7bf46',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                      }
                    : {
                        backgroundColor: '#160e07',
                        border: '1px solid #382413',
                        color: '#a89782'
                      }
                }
                className="p-2.5 rounded-2xl text-left transition-all active:scale-95"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black">TG Bot-Verified</span>
                  <span className="text-[10px] font-mono font-black text-cyan-400">0.20 TON</span>
                </div>
                <p className="text-[10px] opacity-75 mt-0.5 leading-tight">
                  TG Channel/Group bot membership check.
                </p>
              </button>
            </div>
            {verificationType === 'verified' && (
              <div className="p-2.5 rounded-xl bg-[#20140a] border border-[#4a341f] mt-1.5 space-y-1">
                <p className="text-[11px] text-amber-300 font-bold flex items-center space-x-1">
                  <span>🛡️</span>
                  <span>Bot Admin Requirement:</span>
                </p>
                <p className="text-[10px] text-[#a89782] leading-tight font-medium">
                  Add our Bot as Admin in your Telegram Channel or Group, then click <strong>"Verify Admin"</strong> below.
                </p>
              </div>
            )}
          </div>

          {/* 2. Task Category */}
          <div>
            <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider block mb-1.5">
              Task Category {verificationType === 'verified' && '(Channel / Group Only)'}
            </label>
            <div className={`grid ${verificationType === 'verified' ? 'grid-cols-2' : 'grid-cols-4'} gap-1.5`}>
              {(verificationType === 'verified'
                ? [
                    { id: 'channel', label: 'TG Channel' },
                    { id: 'group', label: 'TG Group' }
                  ]
                : [
                    { id: 'website', label: 'Website' },
                    { id: 'channel', label: 'TG Channel' },
                    { id: 'group', label: 'TG Group' },
                    { id: 'bot', label: 'TG Bot' }
                  ]
              ).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setType(item.id);
                    triggerHaptic('selection');
                  }}
                  style={
                    type === item.id
                      ? {
                          background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                          borderTop: '1px solid #825429',
                          borderBottom: '2.5px solid #1c1007',
                          color: '#f7bf46',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                        }
                      : {
                          backgroundColor: '#160e07',
                          border: '1px solid #382413',
                          color: '#a89782'
                        }
                  }
                  className="py-2 text-[11px] font-black rounded-xl text-center transition-all active:scale-95"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Task Title */}
          <div>
            <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider block mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Join Official Community / Visit Platform"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#140c06] border border-[#4a341f] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-[#634e38] focus:border-[#f7bf46] outline-none font-medium transition-colors"
            />
          </div>

          {/* 4. Target Link with Bot Admin Verification Button if TG Bot-Verified */}
          <div>
            <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider block mb-1.5">
              {verificationType === 'verified'
                ? 'Channel / Group Username or Link'
                : 'Destination URL / Telegram Link'}
            </label>
            <div className="flex space-x-2 items-center">
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  required
                  placeholder={
                    verificationType === 'verified'
                      ? '@mychannel or https://t.me/mychannel'
                      : 'https://... or https://t.me/...'
                  }
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    if (verificationType === 'verified') {
                      setAdminVerified(false);
                      setAdminVerifyMessage(null);
                    }
                  }}
                  className="w-full bg-[#140c06] border border-[#4a341f] rounded-2xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-[#634e38] focus:border-[#f7bf46] outline-none font-medium transition-colors"
                />
                <LinkIcon size={15} className="absolute left-3 text-[#a89782]" />
              </div>

              {/* Verify Admin Button for Bot-Verified Channels/Groups */}
              {verificationType === 'verified' && (
                <button
                  type="button"
                  onClick={handleVerifyBotAdmin}
                  disabled={isVerifyingAdmin || !link.trim()}
                  style={
                    adminVerified
                      ? {
                          background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                          borderTop: '1px solid #6ee7b7',
                          borderBottom: '2.5px solid #064e3b',
                          color: '#ffffff'
                        }
                      : {
                          background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 50%, #d48b11 100%)',
                          borderTop: '1px solid #fff2b8',
                          borderBottom: '2.5px solid #7a4b00',
                          color: '#1a0f02'
                        }
                  }
                  className="px-3.5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 shrink-0 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isVerifyingAdmin ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : adminVerified ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Verify</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Verification Status Message */}
            {adminVerified && adminVerifyMessage && (
              <p className="text-[10px] text-emerald-400 font-bold mt-1.5 flex items-center space-x-1">
                <CheckCircle2 size={12} />
                <span>{adminVerifyMessage}</span>
              </p>
            )}
          </div>

          {/* 5. User Quantity Selector (100 - 2000 Users) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider">
                Target User Quantity
              </label>
              <span className="text-xs font-black text-[#f7bf46] font-mono">
                {quantity} Users
              </span>
            </div>

            {/* Quick Quantity Buttons */}
            <div className="grid grid-cols-5 gap-1.5 mb-2.5">
              {quickQuantities.map((qty) => (
                <button
                  type="button"
                  key={qty}
                  onClick={() => handleQuantityChange(qty)}
                  style={
                    quantity === qty
                      ? {
                          background: 'linear-gradient(180deg, #57371a 0%, #3a2512 100%)',
                          borderTop: '1px solid #825429',
                          borderBottom: '2.5px solid #1c1007',
                          color: '#f7bf46'
                        }
                      : {
                          backgroundColor: '#160e07',
                          border: '1px solid #382413',
                          color: '#a89782'
                        }
                  }
                  className="py-1.5 text-[11px] font-black rounded-xl text-center transition-all"
                >
                  {qty}
                </button>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              className="w-full accent-[#f7bf46] h-1.5 bg-[#140c06] rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#634e38] font-bold mt-1">
              <span>Min: 100 Users</span>
              <span>Max: 2,000 Users</span>
            </div>
          </div>

          {/* Pricing & Summary Card */}
          <div
            style={{
              background: 'linear-gradient(180deg, #20140a 0%, #160d05 100%)',
              borderTop: '1.5px solid #57381c',
              borderBottom: '3.5px solid #0c0703',
              boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
            }}
            className="rounded-[24px] p-4 space-y-2 border-x border-[#382413]"
          >
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#a89782] font-medium">Selected Rate</span>
              <span className="text-white font-black font-mono">
                {verificationType === 'verified' ? '100 Users = 0.20 TON' : '100 Users = 0.10 TON'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[#a89782] font-medium">Completer Reward</span>
              <span className="text-[#f7bf46] font-black font-mono">+10 GEMS / hunter</span>
            </div>

            <div className="h-[1px] bg-[#382413]" />

            <div className="flex justify-between items-center pt-0.5">
              <div>
                <p className="text-[11px] text-[#a89782] uppercase font-black">Total Campaign Cost</p>
                <p className="text-[10px] text-[#634e38] font-medium">Draft saved until paid & approved</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[#00f5ff] font-mono drop-shadow-[0_0_8px_rgba(0,245,255,0.4)]">
                  {tonCost.toFixed(2)} TON
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 pb-2">
            <button
              type="submit"
              disabled={loading || (verificationType === 'verified' && !adminVerified)}
              style={{
                background: 'linear-gradient(180deg, #ffdc7a 0%, #f7bf46 45%, #e8a522 100%)',
                borderTop: '1.5px solid #fff2b8',
                borderLeft: '1px solid #e8a522',
                borderRight: '1px solid #e8a522',
                borderBottom: '4px solid #7d4800',
                color: '#1a0f02',
                boxShadow: '0 8px 18px rgba(232, 165, 34, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
              }}
              className="w-full py-3.5 rounded-[22px] text-sm font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all disabled:opacity-50"
            >
              <span>
                {loading
                  ? 'Saving...'
                  : editTask
                  ? 'Update Post Draft'
                  : 'Post Ready · Proceed to My Posts'}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

