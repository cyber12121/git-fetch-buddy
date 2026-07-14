import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Heart, Leaf, Volume2, VolumeX, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GubbyCompanionProps {
  mood?: "happy" | "thoughtful" | "focused" | "cozy" | "excited";
  customMessage?: string;
  xp?: number;
  onHide?: () => void;
}

const LEVEL_TITLES = [
  "Sprout Goblin", "Tiny Goblin", "Helper Goblin", "Apprentice Goblin", "Brave Goblin",
  "Clever Goblin", "Kind Goblin", "Steady Goblin", "Shiny Goblin", "Grand Goblin", "Legend Goblin",
];

function levelTitleFor(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)];
}

const GOBLIN_QUOTES = [
  "Done is better than perfect! Let's make a giant mess of perfect!",
  "Feeling frozen? Break it down so small it feels silly. If 'Write email' is too hard, try 'Open laptop'.",
  "Is your brain a buzzing beehive? Dump it in the Compiler! Gubby will help clean it up.",
  "You opened the app! That's a huge victory. Seriously, starting is the hardest part.",
  "Drink a tiny sip of water right now. Gubby is watching and holding a leaf cup! 🍃",
  "Your worth isn't defined by your checklist. You're a wonderful goblin just for being you.",
  "It's okay to bounce between things! ADHD brains are just super-powered exploration vessels.",
  "If a task feels heavy, it's not because you are lazy—it's just a little scary. Let's make it small!",
  "Gubby is so proud of you for showing up today. Yes, you!",
  "Take a slow, deep breath... hold it... blow out all the noisy thoughts.",
  "Object permanence is hard! If you forgot what you were doing, check the Magic Todo list.",
  "Time blindness is real! That's why Gubby added timers. We can beat time together ⏱️",
  "Hyperfocus is a superpower, but remember to stretch your goblin legs every now and then!",
  "Did you eat something today? A tiny snack counts! Even a single cracker.",
  "Executive dysfunction is like trying to drive a car with no steering wheel. Be gentle with yourself.",
  "It's not 'procrastination', it's your brain looking for dopamine. Let's find a tiny win instead!",
  "You don't have to earn rest. Rest is a biological requirement, like blinking! 🦦",
  "Look at all these buttons! Don't worry, just focus on one quest right now. Just one.",
  "Wandering mind? Let it wander! Then bring it back gently. No scolding allowed.",
  "If it takes 2 minutes, do it now. If it takes longer... put it in the Compiler!"
];

export default function GubbyCompanion({ mood = "cozy", customMessage, xp = 0, onHide }: GubbyCompanionProps) {
  const gubbyLevel = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const levelTitle = levelTitleFor(gubbyLevel);
  const levelEmoji = gubbyLevel >= 10 ? "👑" : gubbyLevel >= 5 ? "⭐" : "🏅";

  const [quote, setQuote] = useState(GOBLIN_QUOTES[0]);
  const [bubbleKey, setBubbleKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playChime = useCallback((enabled: boolean) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio Context blocked or not supported", e);
    }
  }, []);

  useEffect(() => {
    if (customMessage) {
      setQuote(customMessage);
      setBubbleKey(prev => prev + 1);
      playChime(soundEnabled);
    }
  }, [customMessage, playChime, soundEnabled]);

  const getNewQuote = () => {
    const remaining = GOBLIN_QUOTES.filter(q => q !== quote);
    const randomQuote = remaining[Math.floor(Math.random() * remaining.length)];
    setQuote(randomQuote);
    setBubbleKey(prev => prev + 1);
    playChime(soundEnabled);
  };

  // Close the AudioContext on unmount to release the audio hardware.
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Determine avatar icon & details based on mood
  const getGoblinFace = () => {
    switch (mood) {
      case "happy":
        return {
          ears: "👂",
          accessory: "✨",
          title: "Happy Gubby",
          bgColor: "bg-emerald-100 border-emerald-300"
        };
      case "excited":
        return {
          ears: "⚡",
          accessory: "👑",
          title: "Fired Up Gubby!",
          bgColor: "bg-amber-100 border-amber-300"
        };
      case "focused":
        return {
          ears: "🍃",
          accessory: "🎒",
          title: "Focus Gubby",
          bgColor: "bg-orange-100 border-orange-300"
        };
      case "thoughtful":
        return {
          ears: "🍄",
          accessory: "🔮",
          title: "Wise Gubby",
          bgColor: "bg-yellow-100 border-yellow-300"
        };
      case "cozy":
      default:
        return {
          ears: "🍂",
          accessory: "🍄",
          title: "Cozy Gubby",
          bgColor: "bg-surface-raised  border-edge-soft "
        };
    }
  };

  const faceInfo = getGoblinFace();

  return (
    <section
      id="gubby-companion-container"
      aria-label="Gubby companion"
      className="flex flex-col md:flex-row items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-brand-soft/10 border-2 border-edge rounded-2xl max-w-3xl mx-auto my-3 card-shadow relative overflow-hidden"
    >
      {/* Growth pet: level + XP progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-soft/40 z-10">
        <div className="h-full bg-brand transition-all duration-500" style={{ width: `${xpInLevel}%` }} />
      </div>
      <span
        title={`${levelTitle} — ${xpInLevel}/100 XP to next level`}
        className="absolute top-2 right-9 z-10 text-[10px] font-extrabold text-brand bg-surface/85 border border-brand/20 px-2 py-0.5 rounded-full shadow-sm"
      >
        {levelEmoji} Lv {gubbyLevel}
      </span>

      {onHide && (
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide Gubby companion"
          title="Hide Gubby for now"
          className="absolute top-1.5 right-2 z-20 rounded-full p-1 text-ink-muted hover:text-ink hover:bg-black/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26]"
        >
          <X size={14} />
        </button>
      )}

      {/* Absolute Background Accent Leaf */}
      <div className="absolute right-2 -bottom-2 text-emerald-100/40 pointer-events-none select-none">
        <Leaf size={120} strokeWidth={1} />
      </div>

      {/* Gubby Costume Avatar */}
      <div className="relative flex flex-col items-center shrink-0">
        <motion.div 
          animate={{ 
            y: mood === "focused" ? [0, -4, 0] : [0, -8, 0],
            scale: mood === "excited" ? [1, 1.05, 1] : 1
          }}
          transition={{ 
            repeat: Infinity, 
            duration: mood === "focused" ? 2 : 4, 
            ease: "easeInOut" 
          }}
          className={`w-20 h-20 rounded-full ${faceInfo.bgColor} border-2 flex items-center justify-center text-4xl relative shadow-md select-none`}
        >
          {/* Pointy Goblin Ears */}
          <div className="absolute -left-5 top-4 transform -rotate-12 text-3xl">🧝</div>
          <div className="absolute -right-5 top-4 transform rotate-12 scale-x-[-1] text-3xl">🧝</div>
          
          {/* Main Emoji Avatar Expression */}
          <span className="relative z-10">
            {mood === "happy" && "🐸"}
            {mood === "excited" && "🦖"}
            {mood === "focused" && "🦉"}
            {mood === "thoughtful" && "🐢"}
            {mood === "cozy" && "🦦"}
          </span>

          {/* Micro elements */}
          <span className="absolute -top-1 -right-1 text-base">{faceInfo.accessory}</span>
          <span className="absolute -bottom-1 -left-1 text-base">{faceInfo.ears}</span>
        </motion.div>

        <span className="text-xs font-bold mt-1 bg-brand-soft text-brand border border-brand/20 px-2.5 py-0.5 rounded-full mt-2">
          {faceInfo.title}
        </span>
      </div>

      {/* Speech Bubble */}
      <div className="flex-1 min-w-0">
        <div className="relative bg-surface border border-edge p-4 rounded-2xl shadow-sm">
          {/* Bubble Triangle pointer */}
          <div className="absolute left-1/2 md:left-0 top-0 md:top-1/2 transform -translate-x-1/2 md:-translate-x-full -translate-y-1/2 md:-translate-y-1/2 rotate-45 w-3 h-3 bg-surface border-l border-t border-edge"></div>
          
          <AnimatePresence mode="wait">
            <motion.p
              key={bubbleKey}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-ink-2 text-sm md:text-base leading-relaxed font-nunito font-semibold"
            >
              {quote}
            </motion.p>
          </AnimatePresence>
          
          {/* Bubble Actions */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mt-3 pt-2 border-t border-edge text-xs">
            <button
              id="gubby-poke-btn"
              type="button"
              onClick={getNewQuote}
              aria-label="Get a new random encouragement from Gubby"
              className="min-w-0 min-h-11 text-brand hover:text-orange-800 font-bold inline-flex items-center justify-center gap-1.5 transition-colors px-3 py-2 rounded-lg bg-brand-soft/20 hover:bg-brand-soft/40 border border-[#FFD4A3]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Sparkles size={14} aria-hidden="true" />
              <span className="truncate">Random Encouragement 🎲</span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="gubby-sound-toggle"
                type="button"
                onClick={() => {
                  const val = !soundEnabled;
                  setSoundEnabled(val);
                  if (val) {
                    const ctx = getAudioContext();
                    if (ctx.state === "suspended") ctx.resume();
                    playChime(true);
                  }
                }}
                aria-label={soundEnabled ? "Mute Gubby chime" : "Unmute Gubby chime"}
                aria-pressed={soundEnabled}
                className={`inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  soundEnabled
                    ? "bg-brand-soft text-orange-900 hover:bg-brand-soft/80"
                    : "bg-surface-raised text-ink-muted hover:bg-surface-raised2"
                }`}
                title={soundEnabled ? "Mute Gubby chime" : "Unmute Gubby chime"}
              >
                {soundEnabled ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
              </button>

              <span className="hidden sm:flex text-ink-muted select-none items-center gap-1">
                <Heart size={10} className="fill-ink-muted text-ink-muted" aria-hidden="true" /> {levelTitle}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
