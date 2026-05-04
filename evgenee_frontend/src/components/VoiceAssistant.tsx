import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { socket } from '@/lib/socket';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceAssistant() {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [stations, setStations] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const threadIdRef = useRef<string | undefined>(undefined);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
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
  }, []);

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
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
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

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* Chat Bubble */}
      {isOpen && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl p-4 w-80 max-w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              EvGenee Assistant
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              &times;
            </button>
          </div>

          <div className="h-40 overflow-y-auto flex flex-col gap-3 text-sm">
            {transcript && (
              <div className="self-end bg-green-500 text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                {transcript}
              </div>
            )}

            {isProcessing && (
              <div className="self-start bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            )}

            {response && !isProcessing && (
              <div className="self-start bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[95%]">
                {response}
              </div>
            )}

            {stations.length > 0 && (
              <div className="space-y-2 mt-2">
                {stations.map((st) => (
                  <div key={st.id} className={`bg-white dark:bg-zinc-800 border ${st.isOpen ? 'border-zinc-200 dark:border-zinc-700' : 'border-red-200 dark:border-red-900/30 opacity-75'} rounded-xl p-3 shadow-sm`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-xs">{st.name}</p>
                      {st.isOpen ? (
                        <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                          {st.availablePorts}/{st.totalPorts} Ports
                        </span>
                      ) : (
                        <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                          CLOSED
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 mb-2">{st.city}</p>
                    <div className="flex flex-wrap gap-1">
                      {st.chargerTypes.map((type: string) => (
                        <span key={type} className={`text-[9px] ${st.isCompatible && type.includes(transcript.split(' ').pop() || '') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-zinc-100 dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600'} px-1.5 py-0.5 rounded border`}>
                          {type}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between items-center text-[10px]">
                      <span className="text-zinc-400">{st.chargingSpeed} kW</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ₹{st.pricing?.[0]?.priceperKWh || 0}/kWh
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!transcript && !isProcessing && !response && (
              <div className="text-center text-zinc-500 italic mt-8">
                {isListening ? "Listening..." : "Tap the microphone and say e.g. 'Find me a station in Delhi for 2 hours today'"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mic Button */}
      <button
        onClick={toggleListening}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 ${isListening
            ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
      >
        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>
    </div>
  );
}
