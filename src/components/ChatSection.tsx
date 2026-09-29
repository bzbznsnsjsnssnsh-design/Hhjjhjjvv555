import React, { useState, useRef } from 'react';
import { ChatMessage, PiAiStatus } from '../types';
import { Send, Sparkles, Copy, Check, MessageSquare, Bot, User, Clock, Volume2, Play, Pause, AlertCircle, Radio, RefreshCw, Download } from 'lucide-react';

interface ChatSectionProps {
  messages: ChatMessage[];
  piAiStatus: PiAiStatus;
  isBusy: boolean;
  onSendMessage: (text: string) => void;
  onQuickPrompt: (text: string) => void;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
  messages,
  piAiStatus,
  isBusy,
  onSendMessage,
  onQuickPrompt,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isBusy) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleAudio = (msgId: string, audioUrl?: string | null) => {
    if (!audioUrl) return;

    if (playingMsgId === msgId) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingMsgId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingMsgId(null);
      audio.onerror = () => setPlayingMsgId(null);
      audio.play().then(() => {
        setPlayingMsgId(msgId);
      }).catch((e) => {
        console.warn('Audio playback error:', e);
        setPlayingMsgId(null);
      });
    }
  };

  const quickPrompts = [
    'مرحبا، من أنت؟',
    'اشرح الذكاء الاصطناعي بطريقة بسيطة',
    'ما هي أهم مهارات مهندس البرمجيات؟',
    'ما الذي يجعلك مختلفاً عن النماذج الأخرى؟'
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur">
      {/* Top Banner */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">الدردشة الحقيقية مع Pi.ai</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>ظهور فوري للنص + صوت Pi الحقيقي</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[340px] max-h-[520px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-emerald-400">
              <Bot className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">لا توجد رسائل بعد</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              اكتب رسالتك بالأسفل أو اضغط على أحد الأسئلة المقترحة. يظهر النص فور وصوله ويتم تشغيل صوت Pi الحقيقي من صفحته والتقاطه تلقائياً.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onQuickPrompt(prompt)}
                  disabled={isBusy}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50 transition-colors hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isPlayingThis = playingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
                    isUser
                      ? 'bg-blue-600 shadow-md shadow-blue-900/30'
                      : 'bg-emerald-600 shadow-md shadow-emerald-900/30'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 space-y-2.5 ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[11px] opacity-75">
                    <span className="font-semibold">
                      {isUser ? 'رسالة المستخدم' : 'رد Pi.ai الحقيقي'}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3" />
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Immediate Response Text strictly styled with dir=auto, direction: rtl, unicodeBidi: plaintext */}
                  <p
                    dir="auto"
                    style={{ direction: 'rtl', unicodeBidi: 'plaintext' }}
                    className="text-sm leading-relaxed whitespace-pre-wrap font-sans selection:bg-slate-700"
                  >
                    {msg.text}
                  </p>

                  {/* Real Pi Voice Audio Widget on Pi Responses (Direct Fetch, zero recording, zero external TTS) */}
                  {!isUser && (
                    <div className="pt-2 border-t border-slate-700/60 space-y-2">
                      {/* Audio Controls and Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        {msg.audioStatus === 'ready' && msg.audioUrl ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleToggleAudio(msg.id, msg.audioUrl)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                                isPlayingThis
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              {isPlayingThis ? (
                                <>
                                  <Pause className="w-3.5 h-3.5" />
                                  <span>إيقاف الصوت</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span>▶ تشغيل صوت Pi الحقيقي</span>
                                </>
                              )}
                            </button>

                            {msg.audioDuration ? (
                              <span className="text-[11px] font-mono text-teal-300">
                                ⏱ {msg.audioDuration} ثانية
                              </span>
                            ) : null}

                            {msg.audioSizeKb ? (
                              <span className="text-[10px] font-mono text-slate-400">
                                ({msg.audioSizeKb} KB)
                              </span>
                            ) : null}

                            <a
                              href={msg.audioUrl}
                              download={`pi_voice_${msg.id}.mp3`}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 transition-colors"
                              title="تحميل ملف الصوت المباشر"
                            >
                              <Download className="w-3 h-3 text-slate-300" />
                              <span>تحميل MP3</span>
                            </a>
                          </div>
                        ) : msg.audioStatus === 'fetching' ? (
                          <div className="flex items-center gap-1.5 text-sky-300 text-[11px] font-mono animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                            <span>جارٍ جلب ملف الصوت المباشر من Pi.ai...</span>
                          </div>
                        ) : msg.audioStatus === 'error' ? (
                          <div className="flex items-center gap-1.5 text-amber-300 text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>{msg.audioError || 'تعذر جلب ملف الصوت المباشر'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>جاهز لجلب الصوت</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="نسخ النص"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/95">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="اكتب رسالتك هنا ليتم إرسالها إلى صفحة Pi.ai الحقيقية... (اضغط Enter للإرسال)"
              disabled={isBusy}
              rows={3}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="text-slate-500">اقتراحات سريعة:</span>
              <button
                type="button"
                onClick={() => setInputText('مرحبا، من أنت؟')}
                className="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                مرحبا، من أنت؟
              </button>
              <button
                type="button"
                onClick={() => setInputText('اشرح الذكاء الاصطناعي بطريقة بسيطة')}
                className="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                اشرح الذكاء الاصطناعي
              </button>
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isBusy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>إرسال إلى Pi.ai</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
