import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, X, Zap, RotateCcw } from "lucide-react";
import { socket } from "@/lib/socket";
import { BookingsAPI, PaymentAPI } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { AI_OPEN_EVENT } from "@/components/BottomNav";

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const THREAD_KEY = "evgenee_ai_thread_id";

/* ─── Minimal station card ────────────────────────────────── */
function StationCard({ st }: { st: any }) {
  const avail = st.isOpen && st.availablePorts > 0;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${avail ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: "white", lineHeight: 1.3 }}>
          {st.name}
        </p>
        <span
          style={{
            flexShrink: 0,
            fontSize: 9,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: 20,
            background: avail ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
            color: avail ? "#22c55e" : "rgba(255,255,255,0.3)",
            border: `1px solid ${avail ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
            textTransform: "uppercase",
          }}
        >
          {avail ? `${st.availablePorts}/${st.totalPorts} free` : "closed"}
        </span>
      </div>
      <p style={{ margin: "3px 0 6px", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{st.city}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {(st.chargerTypes ?? []).map((type: string) => (
          <span
            key={type}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 6,
              background: st.isCompatible ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
              color: st.isCompatible ? "#22c55e" : "rgba(255,255,255,0.4)",
              border: `1px solid ${st.isCompatible ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {type}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#22c55e" }}>
          ₹{st.pricing?.[0]?.priceperKWh ?? 0}/kWh · {st.chargingSpeed} kW
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════*/
export function VoiceAssistant() {
  const navigate = useNavigate();
  const { isAuthed, isOwner, user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [stations, setStations] = useState<any[]>([]);

  // Persist threadId across page navigations within a session
  const threadIdRef = useRef<string | undefined>(
    typeof window !== "undefined" ? (sessionStorage.getItem(THREAD_KEY) ?? undefined) : undefined
  );

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Don't show for owners or unauthenticated users
  const shouldShow = isAuthed && !isOwner;

  /* ── Auto-scroll chat to bottom ─────────────────────────── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, stations, isProcessing]);

  /* ── Razorpay payment trigger ────────────────────────────── */
  const openRazorpayAdvance = useCallback(
    async (bookingId: string) => {
      try {
        const detailRes = await BookingsAPI.details(bookingId);
        const booking = detailRes.data?.data;
        if (!booking) {
          toast.error("Could not load booking details for payment");
          navigate({ to: "/bookings" });
          return;
        }

        const advanceAmount = parseFloat((booking.grandTotal * 0.2).toFixed(2));
        if (advanceAmount <= 0) {
          navigate({ to: "/bookings" });
          return;
        }

        const currency =
          booking.station?.pricing?.find((p: any) => p.connectorType === booking.connectorType)
            ?.currency ?? "INR";

        const orderRes = await PaymentAPI.createOrder({ amount: advanceAmount, currency });
        const order = orderRes.data;

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount,
          currency: order.currency,
          name: "EvGenee Charging",
          description: `20% Advance for ${booking.station?.name ?? "booking"}`,
          order_id: order.id,
          handler: async (response: any) => {
            try {
              await PaymentAPI.updatePayment({
                orderId: order.id,
                paymentId: response.razorpay_payment_id,
                status: "paid",
              });
              toast.success("Advance paid! Booking confirmed.");
              navigate({ to: "/bookings" });
            } catch {
              toast.error("Payment verification failed");
            }
          },
          prefill: {
            name: user?.name ?? "EvGenee User",
            email: user?.email ?? "user@example.com",
            contact: "9999999999",
          },
          theme: { color: "#22c55e" },
          modal: {
            ondismiss: () => {
              toast.error("Payment cancelled. Pay from Bookings to confirm your slot.");
              navigate({ to: "/bookings" });
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (res: any) => {
          toast.error(`Payment failed: ${res.error.description}`);
        });
        rzp.open();
      } catch (err) {
        toast.error("Failed to initiate advance payment");
        navigate({ to: "/bookings" });
      }
    },
    [navigate, user]
  );

  // Listen for BottomNav AI button → open panel
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(AI_OPEN_EVENT, open);
    return () => window.removeEventListener(AI_OPEN_EVENT, open);
  }, []);

  /* ── Socket listeners ────────────────────────────────────── */
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleResponse = (data: any) => {
      setIsProcessing(false);
      if (!data.success) {
        const errText = data.error ?? "Sorry, something went wrong. Please try again.";
        setMessages((prev) => [...prev, { role: "ai", text: errText }]);
        speakText(errText);
        return;
      }

      const aiText: string = data.response ?? "";
      const newThreadId: string = data.threadId ?? threadIdRef.current;

      // Persist thread so conversation continues across navigations
      threadIdRef.current = newThreadId;
      sessionStorage.setItem(THREAD_KEY, newThreadId);

      setMessages((prev) => [...prev, { role: "ai", text: aiText }]);
      setStations(data.stations ?? []);
      speakText(aiText);

      // Auto-trigger Razorpay 20% advance when booking is confirmed
      if (data.redirect && data.bookingId) {
        setTimeout(() => {
          setIsOpen(false);
          openRazorpayAdvance(data.bookingId);
        }, 2500); // let TTS finish first
      }
    };

    socket.on("ai:voice_response", handleResponse);
    return () => {
      socket.off("ai:voice_response", handleResponse);
    };
  }, [openRazorpayAdvance]);

  /* ── Speech Recognition setup ───────────────────────────── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      const text: string = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(text);
    };

    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.0;
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setStations([]);
    setIsProcessing(true);
    socket.emit("ai:voice_chat", {
      message: text,
      threadId: threadIdRef.current,
    });
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in your browser.");
      return;
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  const clearConversation = () => {
    window.speechSynthesis.cancel();
    setMessages([]);
    setStations([]);
    setIsProcessing(false);
    threadIdRef.current = undefined;
    sessionStorage.removeItem(THREAD_KEY);
  };

  if (!shouldShow) return null;

  /* ─────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────*/
  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
        right: 16,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {/* ── Chat panel ─────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            background: "rgba(7,15,31,0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 24,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)",
            overflow: "hidden",
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            maxHeight: "60vh",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg,#16a34a,#22c55e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Zap size={16} color="white" fill="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: "white" }}>EvGenee AI</p>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                {isListening
                  ? "🎙 Listening…"
                  : isProcessing
                  ? "⚡ Thinking…"
                  : "Tap mic to speak"}
              </p>
            </div>
            <button
              onClick={clearConversation}
              title="New conversation"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.3)",
                padding: 4,
                borderRadius: 8,
                display: "flex",
              }}
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                window.speechSynthesis.cancel();
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.3)",
                padding: 4,
                borderRadius: 8,
                display: "flex",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Welcome prompt */}
            {messages.length === 0 && !isProcessing && (
              <div
                style={{
                  textAlign: "center",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 12,
                  padding: "20px 8px",
                  lineHeight: 1.6,
                }}
              >
                <Zap
                  size={28}
                  color="rgba(34,197,94,0.4)"
                  fill="rgba(34,197,94,0.4)"
                  style={{ display: "block", margin: "0 auto 8px" }}
                />
                <strong style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  Hi! I'm your EV assistant.
                </strong>
                <br />
                Ask me to find & book a charging station — just tap the mic and speak.
              </div>
            )}

            {/* Chat bubbles */}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  background:
                    m.role === "user"
                      ? "linear-gradient(135deg,#16a34a,#22c55e)"
                      : "rgba(255,255,255,0.07)",
                  border: m.role === "ai" ? "1px solid rgba(255,255,255,0.08)" : "none",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "9px 13px",
                  fontSize: 12.5,
                  color: m.role === "user" ? "white" : "rgba(255,255,255,0.85)",
                  lineHeight: 1.5,
                }}
              >
                {m.text}
              </div>
            ))}

            {/* Typing indicator */}
            {isProcessing && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "9px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "#22c55e" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Thinking…</span>
              </div>
            )}

            {/* Station cards */}
            {stations.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {stations.map((st) => (
                  <StationCard key={st.id} st={st} />
                ))}
              </div>
            )}
          </div>

          {/* Mic area */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "10px 14px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                border: "none",
                cursor: isProcessing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isListening
                  ? "linear-gradient(135deg,#dc2626,#ef4444)"
                  : "linear-gradient(135deg,#16a34a,#22c55e)",
                boxShadow: isListening
                  ? "0 0 0 6px rgba(239,68,68,0.2)"
                  : "0 0 0 6px rgba(34,197,94,0.15)",
                opacity: isProcessing ? 0.5 : 1,
                transition: "all 0.2s",
                animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            >
              {isListening ? (
                <MicOff size={22} color="white" />
              ) : (
                <Mic size={22} color="white" />
              )}
            </button>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", maxWidth: 200 }}>
              {isListening
                ? "Listening… tap to stop"
                : isProcessing
                ? "Processing your request…"
                : "Tap to speak to your AI assistant"}
            </span>
          </div>
        </div>
      )}

      {/* ── FAB mic button ─────────────────────────────────── */}
      <button
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
          } else {
            toggleListening();
          }
        }}
        aria-label="AI Voice Assistant"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isListening
            ? "linear-gradient(135deg,#dc2626,#ef4444)"
            : "linear-gradient(135deg,#16a34a,#22c55e)",
          boxShadow: isListening
            ? "0 4px 24px rgba(239,68,68,0.5)"
            : "0 4px 24px rgba(34,197,94,0.4)",
          transition: "all 0.2s",
          animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {isListening ? <MicOff size={22} color="white" /> : <Mic size={22} color="white" />}
      </button>
    </div>
  );
}
