import React, { useState } from 'react';
import {
  X,
  Rocket,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Users,
  CheckCircle2
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import api from '../services/api';

export default function BoostTaskModal({
  isOpen,
  task,
  onClose,
  onTaskBoosted
}) {
  const [boostQuantity, setBoostQuantity] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !task) return null;

  const isVerified = task.verification_type === 'verified';
  const ratePer100 = isVerified ? 0.20 : 0.10;
  const tonCost = Number(((boostQuantity / 100) * ratePer100).toFixed(2));
  const quickQuantities = [100, 200, 500, 1000, 2000];

  const handleQuantityChange = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 100;
    if (num < 100) num = 100;
    if (num > 2000) num = 2000;
    num = Math.round(num / 100) * 100;
    setBoostQuantity(num);
    triggerHaptic('selection');
  };

  const handleBoostSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/tasks/exclusive/boost', {
        taskId: task.id,
        boostQuantity
      });

      if (res.data.success) {
        triggerHaptic('notification', 'success');
        if (onTaskBoosted) {
          onTaskBoosted(res.data.task);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to boost campaign');
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentCap = task.max_users || 100;
  const newCap = currentCap + boostQuantity;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        style={{
          background: 'linear-gradient(180deg, #2b1c10 0%, #1a1008 100%)',
          borderTop: '2px solid #825429',
          borderLeft: '1.5px solid #4a341f',
          borderRight: '1.5px solid #4a341f',
          borderBottom: '5px solid #0f0904',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(247, 191, 70, 0.2)'
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
              background: 'linear-gradient(180deg, #ff8a00 0%, #e52e71 100%)',
              borderTop: '1.5px solid #ffb380',
              borderBottom: '3px solid #7a1538',
              boxShadow: '0 4px 14px rgba(229, 46, 113, 0.4)'
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
          >
            <Rocket size={24} className="animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide">Boost Campaign</h3>
            <p className="text-xs text-[#a89782] font-medium">Add more hunter slots to your live campaign</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-[#2e1313] border border-[#632929] text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Task Info Summary */}
        <div className="p-3 rounded-2xl bg-[#140c06] border border-[#382413] space-y-1 mb-3.5">
          <span className="text-[10px] font-black uppercase text-[#a89782] tracking-wider">Campaign</span>
          <h4 className="text-sm font-black text-white truncate">{task.title}</h4>
          <div className="flex items-center space-x-2 text-[11px] pt-1">
            <span className="text-emerald-400 font-bold font-mono">{task.current_completed || 0} completed</span>
            <span className="text-[#634e38]">/</span>
            <span className="text-[#f7bf46] font-bold font-mono">{currentCap} capacity</span>
          </div>
        </div>

        <form onSubmit={handleBoostSubmit} className="space-y-3.5">
          {/* Boost Quantity Selector */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-black uppercase text-[#a89782] tracking-wider">
                Additional Users (+{boostQuantity})
              </label>
              <span className="text-xs font-black text-[#f7bf46] font-mono">
                New Target: {newCap} Users
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
                    boostQuantity === qty
                      ? {
                          background: 'linear-gradient(180deg, #ff8a00 0%, #e52e71 100%)',
                          borderTop: '1px solid #ffb380',
                          borderBottom: '2.5px solid #7a1538',
                          color: '#ffffff',
                          boxShadow: '0 2px 8px rgba(229, 46, 113, 0.4)'
                        }
                      : {
                          backgroundColor: '#160e07',
                          border: '1px solid #382413',
                          color: '#a89782'
                        }
                  }
                  className="py-1.5 text-[11px] font-black rounded-xl text-center transition-all"
                >
                  +{qty}
                </button>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={boostQuantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              className="w-full accent-[#ff8a00] h-1.5 bg-[#140c06] rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#634e38] font-bold mt-1">
              <span>+100 Users</span>
              <span>+2,000 Users</span>
            </div>
          </div>

          {/* Fresh Audience Guarantee Note */}
          <div className="p-3 rounded-2xl bg-[#1e140c] border border-[#52371c] space-y-1">
            <p className="text-[11px] text-amber-300 font-bold flex items-center space-x-1.5">
              <Sparkles size={13} className="text-[#f7bf46]" />
              <span>100% Fresh Audience Guaranteed</span>
            </p>
            <p className="text-[10px] text-[#a89782] leading-tight font-medium">
              Hunters who completed this quest in the past will NOT see or repeat it. All boosted slots go directly to brand new unique hunters!
            </p>
          </div>

          {/* Pricing & Cost Card */}
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
              <span className="text-[#a89782] font-medium">Verification Type</span>
              <span className="text-[#f7bf46] font-black font-mono">
                {isVerified ? 'TG Bot-Verified (0.20 TON/100)' : 'Quick Task (0.10 TON/100)'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[#a89782] font-medium">New Total Audience Capacity</span>
              <span className="text-white font-black font-mono">{newCap} Users</span>
            </div>

            <div className="h-[1px] bg-[#382413]" />

            <div className="flex justify-between items-center pt-0.5">
              <div>
                <p className="text-[11px] text-[#a89782] uppercase font-black">Boost Cost</p>
                <p className="text-[10px] text-[#634e38] font-medium">Instant reactivation & extension</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[#00f5ff] font-mono drop-shadow-[0_0_8px_rgba(0,245,255,0.4)]">
                  {tonCost.toFixed(2)} TON
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(180deg, #ff8a00 0%, #e52e71 100%)',
              borderTop: '1.5px solid #ffb380',
              borderLeft: '1px solid #ff8a00',
              borderRight: '1px solid #ff8a00',
              borderBottom: '4px solid #7a1538',
              color: '#ffffff',
              boxShadow: '0 8px 18px rgba(229, 46, 113, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
            }}
            className="w-full py-3.5 rounded-[22px] text-sm font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Boosting Campaign...' : `🚀 Boost Campaign (+${boostQuantity} Users)`}</span>
            <ChevronRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
