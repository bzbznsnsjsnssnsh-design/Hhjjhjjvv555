import React from 'react';
import { BrowserStatus, PiAiStatus } from '../types';
import { Play, Square, Globe, RefreshCw, Wifi, Send, Sparkles } from 'lucide-react';

interface BrowserControlsBarProps {
  browserStatus: BrowserStatus;
  piAiStatus: PiAiStatus;
  isBusy: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onOpenPi: () => void;
  onReload: () => void;
  onTestConnection: () => void;
  onSendTest: () => void;
  onOpenSelfTestModal: () => void;
}

export const BrowserControlsBar: React.FC<BrowserControlsBarProps> = ({
  browserStatus,
  piAiStatus,
  isBusy,
  onLaunch,
  onStop,
  onOpenPi,
  onReload,
  onTestConnection,
  onSendTest,
  onOpenSelfTestModal,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-300">أدوات التحكم بالمتصفح:</span>
        <span className="text-[10px] text-slate-500 font-mono">Chromium Direct CDP</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* [ تشغيل المتصفح ] */}
        <button
          onClick={onLaunch}
          disabled={browserStatus === 'connected' || isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-medium transition-all shadow-sm disabled:opacity-40"
        >
          <Play className="w-3.5 h-3.5" />
          <span>تشغيل المتصفح</span>
        </button>

        {/* [ فتح Pi.ai ] */}
        <button
          onClick={onOpenPi}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/60 transition-all disabled:opacity-40"
        >
          <Globe className="w-3.5 h-3.5 text-teal-400" />
          <span>فتح Pi.ai</span>
        </button>

        {/* [ إعادة تحميل Pi.ai ] */}
        <button
          onClick={onReload}
          disabled={browserStatus !== 'connected' || isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/60 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
          <span>إعادة تحميل Pi.ai</span>
        </button>

        {/* [ إيقاف المتصفح ] */}
        <button
          onClick={onStop}
          disabled={browserStatus !== 'connected' || isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/40 transition-all disabled:opacity-40"
        >
          <Square className="w-3.5 h-3.5" />
          <span>إيقاف المتصفح</span>
        </button>

        {/* [ اختبار الاتصال ] */}
        <button
          onClick={onTestConnection}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/60 transition-all disabled:opacity-40"
        >
          <Wifi className="w-3.5 h-3.5 text-sky-400" />
          <span>اختبار الاتصال</span>
        </button>

        {/* [ إرسال اختبار ] */}
        <button
          onClick={onSendTest}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-medium transition-all shadow-sm disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          <span>إرسال اختبار ("مرحبا، من أنت؟")</span>
        </button>

        {/* Full test modal opener */}
        <button
          onClick={onOpenSelfTestModal}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-medium transition-all shadow-sm disabled:opacity-40"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>الاختبارات الإلزامية</span>
        </button>
      </div>
    </div>
  );
};
