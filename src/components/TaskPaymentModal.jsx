import React, { useState } from 'react';
import {
  X,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import confetti from 'canvas-confetti';
import api from '../services/api';

export default function TaskPaymentModal({ task, isOpen, onClose, onPaymentSuccess, onTaskCancelled }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !task) return null;

  const tonCost = task.ton_cost || Number(((task.max_users / 100) * 0.20).toFixed(2));

  const handlePayNow = async () => {
    setLoading(true);
    setError(null);
    triggerHaptic('impact', 'medium');

    try {
      const res = await api.post('/tasks/exclusive/pay', { taskId: task.id });
      if (res.data.success) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
        triggerHaptic('notification', 'success');
        if (onPaymentSuccess) {
          onPaymentSuccess(res.data.task);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed');
      triggerHaptic('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTask = async () => {
    if (!window.confirm('Are you sure you want to cancel and reject this unpaid campaign?')) {
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic('impact', 'light');

    try {
      const res = await api.post('/tasks/exclusive/cancel', { taskId: task.id });
      if (res.data.success) {
        triggerHaptic('notification', 'success');
        if (onTaskCancelled) {
          onTaskCancelled(task.id);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel task');
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
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 245, 255, 0.15)'
        }}
        className="w-full max-w-md rounded-[32px] p-4 sm:p-5 pb-6 relative my-auto max-h-[88vh] overflow-y-auto custom-scrollbar"
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

        {/* Top Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div
            style={{
              background: 'linear-gradient(180deg, #00e5ff 0%, #0099ff 100%)',
              borderTop: '1.5px solid #80f0ff',
              borderBottom: '3px solid #005599',
              boxShadow: '0 4px 12px rgba(0, 229, 255, 0.3)'
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#081b26] shrink-0"
          >
            <CreditCard size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide">Campaign Payment</h3>
            <p className="text-xs text-[#a89782] font-medium">Activate your post to Exclusive Tasks</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-[#2e1313] border border-[#632929] text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Campaign Details Summary */}
        <div
          style={{
            background: 'linear-gradient(180deg, #20140a 0%, #160d05 100%)',
            borderTop: '1.5px solid #57381c',
            borderBottom: '3.5px solid #0c0703',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
          }}
          className="rounded-[24px] p-4 space-y-3 border-x border-[#382413] mb-4"
        >
          <div>
            <p className="text-[10px] text-[#a89782] uppercase font-black tracking-wider">Campaign Title</p>
            <h4 className="text-sm font-black text-white mt-0.5">{task.title}</h4>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#382413]">
            <div>
              <p className="text-[10px] text-[#a89782] uppercase font-black tracking-wider">Target Reach</p>
              <p className="text-xs font-black text-[#f7bf46] font-mono mt-0.5">{task.max_users} Users</p>
            </div>
            <div>
              <p className="text-[10px] text-[#a89782] uppercase font-black tracking-wider">Status</p>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-600/40">
                Pending Payment
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#382413] flex justify-between items-center">
            <div>
              <p className="text-[10px] text-[#a89782] uppercase font-black">Total Payable Amount</p>
              <p className="text-[10px] text-emerald-400 font-medium">100 Users = 0.20 TON</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-[#00f5ff] font-mono drop-shadow-[0_0_10px_rgba(0,245,255,0.4)]">
                {tonCost.toFixed(2)} TON
              </span>
            </div>
          </div>
        </div>

        {/* Notice Info */}
        <div className="p-3 rounded-2xl bg-[#121c21] border border-[#1f3f4d] mb-4 space-y-1">
          <div className="flex items-center space-x-1.5 text-cyan-400 text-xs font-bold">
            <Sparkles size={14} />
            <span>Instant Activation</span>
          </div>
          <p className="text-[11px] text-[#8ea7b3] leading-relaxed">
            Upon payment confirmation, your task will be instantly <b>Approved</b> and live on the public Exclusive Tasks feed. Once {task.max_users} users complete it, it will automatically fulfill.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handlePayNow}
            disabled={loading}
            style={{
              background: 'linear-gradient(180deg, #00f0ff 0%, #00b4d8 50%, #0077b6 100%)',
              borderTop: '1.5px solid #a6f4ff',
              borderLeft: '1px solid #00b4d8',
              borderRight: '1px solid #00b4d8',
              borderBottom: '4px solid #004777',
              color: '#031726',
              boxShadow: '0 8px 18px rgba(0, 180, 216, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.7)'
            }}
            className="w-full py-3.5 rounded-[22px] text-sm font-black tracking-wide uppercase flex items-center justify-center space-x-2 active:translate-y-1 active:border-b-[1px] transition-all"
          >
            <span>{loading ? 'Processing...' : `Pay Now · ${tonCost.toFixed(2)} TON`}</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={handleCancelTask}
            disabled={loading}
            style={{
              background: '#1d120a',
              borderTop: '1px solid #3d2414',
              borderBottom: '2.5px solid #0d0703',
              color: '#f87171'
            }}
            className="w-full py-2.5 rounded-[18px] text-xs font-black uppercase flex items-center justify-center space-x-1.5 active:scale-98 transition-all hover:text-rose-300"
          >
            <Trash2 size={13} />
            <span>Reject / Cancel Post</span>
          </button>
        </div>
      </div>
    </div>
  );
}

