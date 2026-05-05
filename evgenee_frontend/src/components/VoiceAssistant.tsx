import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, VolumeX } from 'lucide-react';
import { socket } from '@/lib/socket';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

import { useAuth } from '@/lib/auth';

export function VoiceAssistant() {
  const { isAuthed, isOwner } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [stations, setStations] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const threadIdRef = useRef<string | undefined>(undefined);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthed) return;

    // Preload voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    // Ensure socket is connected
    if (!socket.connected) {
      socket.connect();
    }

    // Setup Socket Listeners
    socket.on('ai:voice_response', (data: any) => {
      setIsProcessing(false);
      if (data.success) {
        const aiText = data.response;
        threadIdRef.current = data.threadId;
        setResponse(aiText);
        setStations(data.stations || []);
        speakResponse(aiText);

        // Redirect to bookings if a booking was created
        if (data.redirect && data.bookingId) {
          setTimeout(() => {
            toast.success("Redirecting to bookings for payment...");
            navigate({ to: '/bookings' });
          }, 3000); // Small delay to let the AI finish speaking
        }
      } else {
        setResponse(data.error || 'Sorry, I encountered an error. Please try again.');
      }
    });

    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const currentTranscript = event.results[0][0].transcript;
        setTranscript(currentTranscript);
        setIsListening(false);
        processVoiceInput(currentTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      socket.off('ai:voice_response');
    };
  }, [isAuthed, navigate]);

  const processVoiceInput = (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setResponse('');

    // Emit over socket instead of REST API
    socket.emit('ai:voice_chat', {
      message: text,
      threadId: threadIdRef.current,
    });
  };

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);

      const voices = window.speechSynthesis.getVoices();
     
      const preferredVoice = voices.find(v => {
        const lowerName = v.name.toLowerCase();
        return lowerName.includes('female') ||
          lowerName.includes('zira') ||
          lowerName.includes('samantha') ||
          lowerName.includes('google uk english female') ||
          lowerName.includes('aria') ||
          lowerName.includes('jenny') ||
          lowerName.includes('hazel');
      }) || voices.find(v => v.lang.includes('en')) || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        alert("Your browser does not support Speech Recognition.");
        return;
      }
      setTranscript('');
      setResponse('');
      setStations([]);
      setIsListening(true);
      setIsOpen(true);
      recognitionRef.current.start();
    }
  };

  const isAllowedPath = location.pathname === '/' || location.pathname === '/bookings';

  if (!isAuthed || !isAllowedPath || isOwner) return null;

  return (
    <div className="fixed bottom-32 right-4 md:bottom-32 md:right-8 z-[999] flex flex-col items-end gap-3 sm:gap-4">
      
      {isOpen && (
        <div className="bg-white/85 dark:bg-zinc-900/85 backdrop-blur-2xl border border-white/40 dark:border-zinc-700/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl p-5 w-[calc(100vw-2rem)] sm:w-[360px] animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              EvGenee AI
            </h3>
            <div className="flex items-center gap-2">
              {isSpeaking && (
                <button
                  onClick={stopAudio}
                  title="Stop Audio"
                  className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-full bg-red-50 dark:bg-red-900/20 transition-all duration-300 shadow-sm"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
              >
                &times;
              </button>
            </div>
          </div>

          <div className="h-[280px] overflow-y-auto flex flex-col gap-4 text-sm pr-1">
            {transcript && (
              <div className="self-end bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-md">
                {transcript}
              </div>
            )}

            {isProcessing && (
              <div className="self-start bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md text-zinc-600 dark:text-zinc-300 rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-3 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="font-medium">Thinking...</span>
              </div>
            )}

            {response && !isProcessing && (
              <div className="self-start bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-5 py-3.5 max-w-[95%] shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 leading-relaxed font-medium">
                {response}
              </div>
            )}

            {stations.length > 0 && (
              <div className="space-y-3 mt-3">
                {stations.map((st) => (
                  <div key={st.id} className={`bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l-4 ${st.isCompatible ? 'border-l-green-500 shadow-lg shadow-green-500/10' : st.isOpen ? 'border-l-zinc-300 dark:border-l-zinc-700 shadow-md' : 'border-l-red-400 opacity-80 shadow-sm'} rounded-r-2xl rounded-l-sm p-4 transition-all hover:-translate-y-0.5 duration-300`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-[15px] text-zinc-800 dark:text-zinc-100">{st.name}</p>
                      {st.isOpen ? (
                        <span className="text-[10px] bg-green-100/80 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2.5 py-1 rounded-full font-bold shadow-sm">
                          {st.availablePorts}/{st.totalPorts} Ports
                        </span>
                      ) : (
                        <span className="text-[10px] bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-2.5 py-1 rounded-full font-bold shadow-sm">
                          CLOSED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600"></span> {st.city}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {st.chargerTypes.map((type: string) => (
                        <span key={type} className={`text-[10px] font-semibold tracking-wide ${st.isCompatible ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'} px-2 py-1 rounded-md border shadow-sm`}>
                          {type}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1.5">⚡ {st.chargingSpeed} kW Fast</span>
                      <span className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                        ₹{st.pricing?.[0]?.priceperKWh || 0}/kWh
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!transcript && !isProcessing && !response && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-center px-4 animate-in fade-in duration-700">
                <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/10 flex items-center justify-center text-green-500 shadow-inner">
                  <Mic className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isListening ? "I'm listening..." : "How can I help you today?"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  {isListening ? "Speak clearly into your microphone." : "Tap the mic and say e.g. 'Find a station in Delhi'."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Premium Mic Button & Label */}
      <div className="flex flex-col items-center gap-2 group">
        <button
          onClick={toggleListening}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_30px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-xl ${
            isListening
              ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
              : 'bg-[#000814]/90 text-[#22c55e]'
            }`}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40"></span>
          )}
          {isListening ? (
            <MicOff className="w-6 h-6 relative z-10" />
          ) : (
            <Mic className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform duration-300" />
          )}
        </button>
        
        <span 
          className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-600 transition-all duration-500 group-hover:tracking-[0.4em] group-hover:text-[#22c55e] opacity-80"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Fastrack
        </span>
      </div>
    </div>
  );
}
