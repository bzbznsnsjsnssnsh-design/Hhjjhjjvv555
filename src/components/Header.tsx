import React from 'react';
import { BrowserStatus, PiAiStatus } from '../types';
import { Globe, Cpu, ShieldAlert, CheckCircle2, XCircle, RefreshCw, Play, Square, Sparkles } from 'lucide-react';

interface HeaderProps {
  browserStatus: BrowserStatus;
  piAiStatus: PiAiStatus;
  wsConnected: boolean;
  isBusy: boolean;
  busyAction: string | null;
  onLaunch: () => void;
  onStop: () => void;
  onOpenPi: () => void;
  onReload: () => void;
  onRunTest: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  browserStatus,
  piAiStatus,
  wsConnected,
  isBusy,
  busyAction,
  onLaunch,
  onStop,
  onOpenPi,
  onReload,
  onRunTest,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Purpose */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Pi.ai Chromium Controller</h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Chromium أصلي
              </span>
            </div>
            <p className="text-xs text-slate-400">
              جلسة متصفح Chromium حقيقية تتصل بـ https://pi.ai وتتفاعل مع الـ DOM الفعلي
            </p>
          </div>
        </div>

        {/* Real-time Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Browser Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 bg-slate-950/70 border-slate-800">
            <span className="text-slate-400">حالة المتصفح:</span>
            {browserStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Browser Connected
              </span>
            ) : browserStatus === 'launching' ? (
              <span className="inline-flex items-center gap-1.5 text-amber-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Launching...
              </span>
            ) : browserStatus === 'stopping' ? (
              <span className="inline-flex items-center gap-1.5 text-amber-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Stopping...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Browser Disconnected
              </span>
            )}
          </div>

          {/* Pi.ai Page Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium bg-slate-950/70 border-slate-800">
            <span className="text-slate-400">حالة Pi.ai:</span>
            {piAiStatus === 'ready' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Pi.ai Ready
              </span>
            ) : piAiStatus === 'waiting_captcha_login' ? (
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Waiting for Login/CAPTCHA
              </span>
            ) : piAiStatus === 'loading' ? (
              <span className="inline-flex items-center gap-1.5 text-sky-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Loading Pi.ai...
              </span>
            ) : piAiStatus === 'error' ? (
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Pi.ai Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                Unloaded
              </span>
            )}
          </div>

          {/* WebSocket Link */}
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              wsConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
            title={wsConnected ? 'Real-time WebSocket Connected' : 'WebSocket Disconnected'}
          />
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {browserStatus !== 'connected' ? (
            <button
              onClick={onLaunch}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              تشغيل المتصفح
            </button>
          ) : (
            <>
              <button
                onClick={onOpenPi}
                disabled={isBusy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                title="فتح رابط Pi.ai في المتصفح"
              >
                <Globe className="w-3.5 h-3.5 text-teal-400" />
                فتح Pi.ai
              </button>
              <button
                onClick={onReload}
                disabled={isBusy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                title="إعادة تحميل الصفحة"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                إعادة تحميل
              </button>
              <button
                onClick={onStop}
                disabled={isBusy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/40 transition-colors disabled:opacity-50"
                title="إيقاف المتصفح وإغلاق الجلسة"
              >
                <Square className="w-3.5 h-3.5" />
                إيقاف
              </button>
            </>
          )}

          <button
            onClick={onRunTest}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            اختبار الـ 7 خطوات
          </button>
        </div>
      </div>

      {/* Busy Action Bar */}
      {isBusy && (
        <div className="mt-2 text-xs py-1 px-3 bg-indigo-950/70 border border-indigo-800/60 rounded-lg flex items-center justify-between text-indigo-200 animate-pulse">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            {busyAction || 'جارٍ التنفيذ...'}
          </span>
          <span className="text-[10px] text-indigo-400 uppercase font-mono tracking-wider">Active CDP Session</span>
        </div>
      )}
    </header>
  );
};
