import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { socket } from '@/lib/socket';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
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
        speakResponse(aiText);
      } else {
        setResponse('Sorry, I encountered an error. Please try again.');
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
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 ${
          isListening 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white' 
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>
    </div>
  );
}
