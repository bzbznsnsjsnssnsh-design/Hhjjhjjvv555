import React, { useState, useRef } from 'react';
import { AudioItem, AudioStatus } from '../types';
import { Volume2, Play, Pause, AlertCircle, CheckCircle2, Clock, Sparkles, RefreshCw, VolumeX, Radio } from 'lucide-react';

interface AudioSessionPanelProps {
  audioQueue: AudioItem[];
  isCaptureActive: boolean;
  lastCapturedDuration: number;
}

export const AudioSessionPanel: React.FC<AudioSessionPanelProps> = ({
  audioQueue,
  isCaptureActive,
  lastCapturedDuration
}) => {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const handleTogglePlay = (audioId: string, audioUrl: string) => {
    if (playingAudioId === audioId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => setPlayingAudioId(null);
      audio.play().then(() => {
        setPlayingAudioId(audioId);
      }).catch((e) => {
        console.warn('Audio play request error:', e);
        setPlayingAudioId(null);
      });
    }
  };

  const getStatusBadge = (status: AudioStatus) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Ready (ملف صوت Pi الحقيقي جاهز)
          </span>
        );
      case 'fetching':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Fetching (جلب تيار الصوت المباشر)
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Preparing (تجهيز معرف الرسالة)
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            Fetch Unavailable
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Idle
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur flex flex-col space-y-4 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-teal-900/30">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              مدير جلسة الصوت (AudioSessionManager)
            </h2>
            <p className="text-xs text-slate-400">
              التقاط صوت Pi.ai الحقيقي من صفحة المتصفح وعزله لكل رد بشكل مستقل دون خلط الأصوات
            </p>
          </div>
        </div>

        {/* Live Audio Capture Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Audio Capture:</span>
            {isCaptureActive ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVE
              </span>
            ) : (
              <span className="text-slate-400">STANDBY</span>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Last Duration:</span>
            <span className="text-teal-400 font-bold">{lastCapturedDuration}s</span>
          </div>
        </div>
      </div>

      {/* Audio Policy Banner */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-200">
            مبدأ الصوت الأصلي: مصدر الصوت هو Pi.ai نفسه 100%
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            لا يتم استخدام أي مولد خارجي مثل Google TTS أو Web Speech API. عند وصول أي رد جديد، يقوم النظام بالضغط على زر السماعة (Listen) داخل صفحة Pi.ai ويلتقط تيار الصوت الناتج من متصفح Chromium، ويخزنه في قائمة انتظار مرتبطة بالرد المحدد (responseId).
          </p>
        </div>
      </div>

      {/* Audio Queue List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>قائمة المقاطع الصوتية (Audio Queue):</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono text-[11px]">
            {audioQueue.length} عناصر
          </span>
        </h3>

        {audioQueue.length === 0 ? (
          <div className="bg-slate-950/60 rounded-xl border border-slate-800/60 p-8 text-center space-y-2">
            <VolumeX className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">لا توجد تسجيلات صوتية بعد</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              أرسل رسالة في المحادثة مثل "مرحبا، من أنت؟". سيتم تفعيل زر السماعة تلقائياً في صفحة Pi.ai والتقاط الصوت الحقيقي هنا.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {audioQueue.slice().reverse().map((item) => {
              const isPlaying = playingAudioId === item.audioId;

              return (
                <div
                  key={item.audioId}
                  className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(item.status)}
                      <span className="text-[11px] font-mono text-slate-500">
                        [{item.timestamp}]
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        ID: {item.audioId.slice(0, 14)}
                      </span>
                      {item.durationSeconds ? (
                        <span className="text-[11px] font-mono text-teal-400 font-bold">
                          ⏱ {item.durationSeconds} ثانية
                        </span>
                      ) : null}
                    </div>

                    {item.userPrompt && (
                      <div className="text-xs text-slate-400">
                        <span className="text-slate-500">السؤال:</span> "{item.userPrompt}"
                      </div>
                    )}

                    {item.responseText && (
                      <div className="text-xs text-slate-300 truncate">
                        <span className="text-slate-500">بداية الرد:</span> {item.responseText}...
                      </div>
                    )}

                    {item.errorReason && (
                      <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/40 rounded-lg p-2 font-mono">
                        {item.errorReason}
                      </div>
                    )}
                  </div>

                  {/* Player Button for Ready Audio */}
                  {item.status === 'ready' && item.audioUrl && (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePlay(item.audioId, item.audioUrl!)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer ${
                          isPlaying
                            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4" />
                            <span>إيقاف مؤقت</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>تشغيل صوت Pi الحقيقي</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
