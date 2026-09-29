import React from 'react';
import { NavigationTab } from '../types';
import { Columns, MessageSquare, Monitor, Volume2, Activity, ShieldCheck } from 'lucide-react';
import { freezeDetector } from '../utils/freezeDetector';

interface NavigationTabsProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  audioQueueCount: number;
  hasActiveAudio: boolean;
  uiFreeze: 'NO' | 'YES';
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  audioQueueCount,
  hasActiveAudio,
  uiFreeze
}) => {
  const tabs = [
    {
      id: 'split' as NavigationTab,
      label: 'لوحة التحكم المتكاملة',
      subtitle: 'عرض متزامن (الدردشة + شاشة Chromium)',
      icon: Columns
    },
    {
      id: 'chat' as NavigationTab,
      label: 'الدردشة وصوت Pi الحقيقي',
      subtitle: 'استخراج فوري للنص + تشغيل صوت Pi الحقيقي',
      icon: MessageSquare
    },
    {
      id: 'viewport' as NavigationTab,
      label: 'شاشة Chromium المباشرة',
      subtitle: 'بث حي تفاعلي بدقة 1280×800 مع CDP Mouse/Keys',
      icon: Monitor
    },
    {
      id: 'audio' as NavigationTab,
      label: 'جلسة الصوت والالتقاط',
      subtitle: 'AudioSessionManager وإدارة قوائم الصوت',
      icon: Volume2,
      badge: audioQueueCount > 0 ? audioQueueCount : null,
      pulse: hasActiveAudio
    },
    {
      id: 'diagnostics' as NavigationTab,
      label: 'مراقبة الاستقرار والتجميد',
      subtitle: 'كاشف Freeze Detector وسجلات النظام الـ 18',
      icon: Activity
    }
  ];

  const handleSelect = (id: NavigationTab) => {
    if (id === activeTab) return;
    freezeDetector.onNavigationStart(id);
    onTabChange(id);
    // Request animation frame to measure paint completion
    requestAnimationFrame(() => {
      freezeDetector.onNavigationComplete(id);
    });
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-2 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap items-center gap-1.5" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelect(tab.id)}
                className={`relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                    : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>

                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white text-emerald-700'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}

                {tab.pulse && (
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Real-time Navigation Stability Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Navigation: <strong className="text-emerald-400">Stable</strong></span>
          <span>•</span>
          <span>UI Freeze: <strong className={uiFreeze === 'NO' ? 'text-emerald-400' : 'text-rose-400'}>{uiFreeze}</strong></span>
        </div>
      </div>
    </div>
  );
};
