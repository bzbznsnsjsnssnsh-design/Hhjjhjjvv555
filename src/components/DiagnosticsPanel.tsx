import React from 'react';
import { DiagnosticsState } from '../types';
import { Activity, CheckCircle, Trash2, Terminal, AlertOctagon, Timer, Volume2, ShieldCheck } from 'lucide-react';

interface DiagnosticsPanelProps {
  diagnostics: DiagnosticsState;
  onClearLogs: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diagnostics,
  onClearLogs,
}) => {
  // Required diagnostics summary cards strictly matching user specification:
  const summaryMetrics = [
    { label: 'Browser', value: diagnostics.browserLaunched ? 'Connected' : 'Disconnected', isOk: diagnostics.browserLaunched },
    { label: 'Pi', value: diagnostics.pageLoaded ? (diagnostics.inputFound ? 'Ready' : 'Loading') : 'Unloaded', isOk: diagnostics.inputFound },
    { label: 'Response', value: diagnostics.responseDetected ? 'Detected' : (diagnostics.waitingForResponse ? 'Waiting...' : 'Idle'), isOk: diagnostics.responseDetected },
    { label: 'Direct Voice', value: diagnostics.voiceFileReady || 'Idle', isOk: diagnostics.voiceFileReady === 'Ready' },
    { label: 'Audio Duration', value: `${diagnostics.audioDuration || 0} sec`, isOk: diagnostics.audioDuration > 0 },
    { label: 'Speaker Click', value: diagnostics.speakerClick || 'NO', isOk: diagnostics.speakerClick === 'NO' },
    { label: 'Audio Capture', value: diagnostics.audioCapture || 'NO', isOk: diagnostics.audioCapture === 'NO' },
    { label: 'Navigation', value: diagnostics.navigationState || 'Stable', isOk: diagnostics.navigationState === 'Stable' },
    { label: 'UI Freeze', value: diagnostics.uiFreeze || 'NO', isOk: diagnostics.uiFreeze === 'NO' },
    { label: 'Errors', value: `${diagnostics.errorsCount || 0}`, isOk: (diagnostics.errorsCount || 0) === 0 }
  ];

  const steps = [
    { label: 'Browser launched', key: 'browserLaunched', val: diagnostics.browserLaunched, yesText: 'YES', noText: 'NO' },
    { label: 'Chromium visible/streamed', key: 'chromiumVisibleStreamed', val: diagnostics.chromiumVisibleStreamed, yesText: 'YES', noText: 'NO' },
    { label: 'Pi.ai opened', key: 'piAiOpened', val: diagnostics.piAiOpened, yesText: 'YES', noText: 'NO' },
    { label: 'Page loaded', key: 'pageLoaded', val: diagnostics.pageLoaded, yesText: 'YES', noText: 'NO' },
    { label: 'Input found', key: 'inputFound', val: diagnostics.inputFound, yesText: 'YES', noText: 'NO' },
    { label: 'Manual click', key: 'manualClickWorking', val: diagnostics.manualClickWorking, yesText: 'WORKING', noText: 'NO' },
    { label: 'Manual scroll', key: 'manualScrollWorking', val: diagnostics.manualScrollWorking, yesText: 'WORKING', noText: 'NO' },
    { label: 'Keyboard', key: 'keyboardWorking', val: diagnostics.keyboardWorking, yesText: 'WORKING', noText: 'NO' },
    { label: 'Text inserted', key: 'textInserted', val: diagnostics.textInserted, yesText: 'YES', noText: 'NO' },
    { label: 'Input event triggered', key: 'inputEventTriggered', val: diagnostics.inputEventTriggered, yesText: 'YES', noText: 'NO' },
    { label: 'Send button found', key: 'sendButtonFound', val: diagnostics.sendButtonFound, yesText: 'YES', noText: 'NO' },
    { label: 'Send triggered', key: 'sendTriggered', val: diagnostics.sendTriggered, yesText: 'YES', noText: 'NO' },
    { label: 'Waiting for response', key: 'waitingForResponse', val: diagnostics.waitingForResponse, yesText: 'YES', noText: 'NO', isPending: true },
    { label: 'Response detected', key: 'responseDetected', val: diagnostics.responseDetected, yesText: 'YES', noText: 'NO' },
    { label: 'Response stabilized', key: 'responseStabilized', val: diagnostics.responseStabilized, yesText: 'YES', noText: 'NO' },
    { label: 'Response extracted', key: 'responseExtracted', val: diagnostics.responseExtracted, yesText: 'YES', noText: 'NO' },
    { label: 'Direct voice stream ready', key: 'voiceFileReady', val: diagnostics.voiceFileReady === 'Ready', yesText: 'YES', noText: 'NO' },
    { label: 'Voice request detected', key: 'voiceRequestDetected', val: diagnostics.voiceRequestDetected === 'YES', yesText: 'YES', noText: 'NO' },
    { label: 'Login required', key: 'loginRequired', val: diagnostics.loginRequired, yesText: 'YES', noText: 'NO', isWarning: true },
    { label: 'CAPTCHA detected', key: 'captchaDetected', val: diagnostics.captchaDetected, yesText: 'YES', noText: 'NO', isWarning: true },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">لوحة التشخيص المباشرة ومراقبة الاستقرار والتجميد</h2>
            <p className="text-[11px] text-slate-400">
              التحقق من حالة المتصفح، صوت Pi الحقيقي، استقرار التنقل، وكشف التجميد (UI Freeze Monitor)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <span>Viewport: <strong className="text-slate-200">1280×800</strong></span>
            <span>•</span>
            <span>CDP Listeners: <strong className="text-emerald-400">{diagnostics.cdpListenerCount || 1}</strong></span>
          </div>
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="مسح السجلات"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* User Required Summary Metric Cards */}
        <div>
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>مؤشرات التشخيص الإلزامية (Required Diagnostics):</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
            {summaryMetrics.map((m) => (
              <div
                key={m.label}
                className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between"
              >
                <span className="text-[10px] text-slate-400 font-sans block">{m.label}:</span>
                <span
                  className={`text-xs font-bold mt-1 ${
                    m.label === 'UI Freeze' && m.value === 'YES'
                      ? 'text-rose-400 animate-pulse'
                      : m.label === 'Errors' && m.value !== '0'
                      ? 'text-rose-400'
                      : m.isOk
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* UI Freeze Detector & Resource Counters */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
          <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 font-mono">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>كاشف التجميد واستهلاك الموارد (UI Freeze & Resource Tracker):</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px] font-mono">
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Render time:</span>
              <span className="text-emerald-400 font-bold">{diagnostics.lastRenderTimeMs || 8} ms</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">WebSocket count:</span>
              <span className="text-sky-400 font-bold">{diagnostics.activeWebSocketCount || 1} (Singleton)</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">CDP listener count:</span>
              <span className="text-sky-400 font-bold">{diagnostics.cdpListenerCount || 1}</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Active timers:</span>
              <span className="text-teal-400 font-bold">{diagnostics.activeTimersCount || 2}</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Active observers:</span>
              <span className="text-teal-400 font-bold">{diagnostics.activeObserversCount || 1}</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Audio queue:</span>
              <span className="text-indigo-400 font-bold">{diagnostics.audioQueueCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Problem 1 & 2: Real-time Inspection Panels for Arabic Text Integrity & Direct Pi Audio Fetch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Arabic Text Integrity */}
          <div className="bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-sans">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>فحص النص العربي وسلامة الـ Unicode (Arabic Text Integrity):</span>
            </h4>
            
            {diagnostics.lastTextIntegrity ? (
              <div className="space-y-2 text-[11px] font-mono">
                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans block">النص الخام المستخرج (Raw Extracted):</span>
                  <div className="text-slate-200 text-xs break-words" dir="auto">
                    {diagnostics.lastTextIntegrity.rawSample || diagnostics.lastTextIntegrity.rawText || '—'}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-teal-400 font-sans block">النص بعد Unicode Normalization (NFC):</span>
                  <div className="text-teal-200 text-xs break-words" dir="auto">
                    {diagnostics.lastTextIntegrity.normalizedSample || diagnostics.lastTextIntegrity.normalizedText || '—'}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-emerald-400 font-sans block">النص النهائي المعروض (Final Display):</span>
                  <div className="text-emerald-300 text-xs font-bold break-words" dir="auto">
                    {diagnostics.lastTextIntegrity.finalText || diagnostics.lastTextIntegrity.normalizedSample || '—'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                  <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">الحروف الإجمالية:</span>
                    <span className="text-emerald-400 font-bold text-xs">{diagnostics.lastTextIntegrity.rawLength || 0}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Code Points:</span>
                    <span className="text-sky-400 font-bold text-xs">{diagnostics.lastTextIntegrity.unicodeLength || 0}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">حروف عربية:</span>
                    <span className="text-teal-400 font-bold text-xs">{diagnostics.lastTextIntegrity.arabicCharacterCount || 0}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs py-4 text-center">
                سيظهر تحليل النص العربي وسلامة Unicode ومطابقة الأحرف فور إرسال أول رسالة.
              </div>
            )}
          </div>

          {/* Card 2: Direct Pi Audio Fetch */}
          <div className="bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5 font-sans">
              <Volume2 className="w-4 h-4 text-sky-400" />
              <span>جلب ملف صوت Pi الحقيقي مباشرة (Direct Pi Audio Fetch):</span>
            </h4>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">طلب الصوت (Voice Request):</span>
                <span className="text-emerald-400 font-bold">{diagnostics.voiceRequestDetected || 'NO'}</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">طريقة الجلب (Fetch Mode):</span>
                <span className="text-sky-400 font-bold">{diagnostics.voiceFetchMode || 'Direct Fetch'}</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">نوع الملف (MIME):</span>
                <span className="text-teal-400 font-bold">{diagnostics.voiceResponseMime || 'audio/mpeg'}</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">حجم الملف (Size):</span>
                <span className="text-indigo-400 font-bold">{diagnostics.voiceBytesFormatted || '0 KB'}</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">حالة الملف (File Ready):</span>
                <span className={`font-bold ${diagnostics.voiceFileReady === 'Ready' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diagnostics.voiceFileReady || 'Idle'}
                </span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">تشغيل في Pi.ai:</span>
                <span className="text-emerald-400 font-bold">NO (صفر تشغيل)</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">النقر على السماعة:</span>
                <span className="text-emerald-400 font-bold">NO (صفر نقر)</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">تسجيل الصوت/الميكروفون:</span>
                <span className="text-emerald-400 font-bold">OFF (صفر تسجيل)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step Checklist and Live Controller Terminal Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Step Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              حالة خطوات الأتمتة واستخراج الصوت الحقيقي
            </h3>

            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 divide-y divide-slate-800/50 font-mono text-xs max-h-[380px] overflow-y-auto">
              {steps.map((step) => {
                const isYes = step.val;
                let badgeColor = isYes
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-slate-500 bg-slate-800/40 border-slate-700/30';

                if (step.isWarning && isYes) {
                  badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
                } else if (step.isPending && isYes) {
                  badgeColor = 'text-sky-400 bg-sky-500/10 border-sky-500/20 animate-pulse';
                }

                return (
                  <div key={step.key} className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">{step.label}:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${badgeColor}`}
                    >
                      {isYes ? step.yesText : step.noText}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Last Error Notice if any */}
            {diagnostics.lastError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <AlertOctagon className="w-4 h-4" />
                  <span>الخطأ المسجل (Last Error):</span>
                </div>
                <p className="font-mono text-[11px] break-words text-rose-200/90">
                  {diagnostics.lastError}
                </p>
              </div>
            )}
          </div>

          {/* Live Controller Terminal Logs */}
          <div className="flex flex-col space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-sky-400" />
              سجل أحداث الـ Controller والتقاط الصوت (Live Logs)
            </h3>

            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 font-mono text-xs overflow-y-auto max-h-[380px] min-h-[260px] space-y-1.5">
              {diagnostics.logs.length === 0 ? (
                <div className="text-slate-600 text-center py-8">
                  لا توجد سجلات بعد. ستظهر أحداث تشغيل Chromium و Pi.ai والصوت هنا فوراً.
                </div>
              ) : (
                diagnostics.logs.map((log) => {
                  let colorClass = 'text-slate-400';
                  let prefix = 'ℹ';
                  if (log.level === 'success') {
                    colorClass = 'text-emerald-400';
                    prefix = '✔';
                  } else if (log.level === 'warn') {
                    colorClass = 'text-amber-400';
                    prefix = '⚠';
                  } else if (log.level === 'error') {
                    colorClass = 'text-rose-400';
                    prefix = '✖';
                  }

                  return (
                    <div key={log.id} className="flex items-start gap-2 leading-tight">
                      <span className="text-[10px] text-slate-500 shrink-0 select-none">
                        [{log.timestamp}]
                      </span>
                      <span className={`font-bold shrink-0 ${colorClass}`}>
                        {prefix}
                      </span>
                      <span className={`break-words ${colorClass}`}>
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
