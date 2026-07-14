import React, { useState } from "react";
import { Sparkles, Brain, ArrowRight, Trash2, Check, AlertCircle, Mic, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import { useSpeechRecognition } from "../lib/useSpeechRecognition";
import { PRIORITY_CHIP } from "../lib/constants";
import { compileBrainDump } from "../lib/goblin-api.functions";

interface CompilerModuleProps {
  onTasksCompiled: (newTasks: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">[]) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
}

const TEMPLATES = [
  {
    label: "🏡 Sunday Dread Dump",
    text: "Ugh my laundry is completely piled up, need to do darks and whites. Also the sink is leaking again, I have to email the landlord. Oh and I need groceries! Eggs, bread, maybe some apples. Also need to renew my passport before July ends or I'm in trouble. And my friend's birthday is coming, what should I get them?"
  },
  {
    label: "💼 Work Backlog Overflow",
    text: "So many things to do today... I have to finish the project presentation slides for tomorrow's meeting, but I also need to respond to 15 unread emails. Gotta review the budget sheet for Q3. Oh! Don't forget to submit the travel expense reports, and call Sarah to schedule the demo."
  },
  {
    label: "🧠 General Brain Buzzing",
    text: "I want to start working out more, maybe find a local gym? Also my car is making a weird squeaking noise when I brake, need to call the mechanic. I forgot to water the ferns today. I need to clean the closet because I can't find my green boots. Should probably pay the electricity bill before they charge a late fee."
  }
];

export default function CompilerModule({ onTasksCompiled, onGubbyMessage }: CompilerModuleProps) {
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Temporary preview list of parsed tasks before committing
  const [tempTasks, setTempTasks] = useState<{ id: string; title: string; priority: "low" | "medium" | "high"; notes: string; selected: boolean }[]>([]);

  // Voice dictation for the brain dump. Each finalized phrase is appended.
  const speech = useSpeechRecognition((text) => {
    setRawText((prev) => (prev ? `${prev} ${text}` : text));
    setError(null);
    onGubbyMessage("Gubby is listening! Keep dumping those thoughts out loud 🎤", "thoughtful");
  });

  const handleLoadTemplate = (text: string) => {
    setRawText(text);
    setError(null);
    onGubbyMessage("That's a juicy brain dump! Let's hit compile when you're ready.", "thoughtful");
  };

  const handleCompile = async () => {
    if (!rawText.trim()) {
      setError("Please write or paste your messy thoughts first! Gubby needs material to work with.");
      return;
    }

    setIsLoading(true);
    setError(null);
    onGubbyMessage("Gubby is sweeping up the clutter and sorting your thoughts with magical AI...", "focused");

    try {
      const data = await compileBrainDump({ data: { rawText } });
      const formatted = (data.tasks || []).map((t: any) => ({
        id: crypto.randomUUID(),
        title: t.title || "Untitled Task",
        priority: (t.priority === "low" || t.priority === "medium" || t.priority === "high") ? t.priority : "medium",
        notes: t.notes || "",
        selected: true
      }));

      setTempTasks(formatted);

      if (formatted.length > 0) {
        onGubbyMessage(`We did it! Gubby found ${formatted.length} actionable missions. Check them below!`, "excited");
      } else {
        onGubbyMessage("Hmm, we parsed it but didn't find clear tasks. Try adding some action words!", "cozy");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to compile. Please check your network connection or try again.");
      onGubbyMessage("Oops! My magical sorting hat got tangled in some wires. Let's try again!", "cozy");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (index: number) => {
    const updated = [...tempTasks];
    updated[index].selected = !updated[index].selected;
    setTempTasks(updated);
  };

  const handleUpdateTitle = (index: number, newTitle: string) => {
    const updated = [...tempTasks];
    updated[index].title = newTitle;
    setTempTasks(updated);
  };

  const handleUpdatePriority = (index: number, priority: "low" | "medium" | "high") => {
    const updated = [...tempTasks];
    updated[index].priority = priority;
    setTempTasks(updated);
  };

  const handleDeleteTemp = (index: number) => {
    setTempTasks(tempTasks.filter((_, i) => i !== index));
  };

  const handleSendToTodo = () => {
    const selected = tempTasks.filter(t => t.selected);
    if (selected.length === 0) {
      setError("Please select at least one task to send to Magic To-Do!");
      return;
    }

    onTasksCompiled(selected.map(t => ({
      title: t.title,
      priority: t.priority,
      notes: t.notes
    })));

    // Clear compiler state
    setRawText("");
    setTempTasks([]);
    onGubbyMessage("Woohoo! Pushed all missions safely into the Magic To-Do. Teleporting you there now!", "happy");
  };

  const getPriorityColor = (priority: "low" | "medium" | "high") => {
    return PRIORITY_CHIP[priority];
  };

  return (
    <div id="compiler-module" className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-surface p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-edge card-shadow">
        <div className="flex items-start gap-2.5 sm:gap-3 mb-4">
          <div className="p-2 sm:p-3 bg-brand-soft/30 text-brand rounded-xl sm:rounded-2xl shrink-0">
            <Brain className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-ink font-fredoka leading-tight">The Brain Dump Compiler</h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-snug mt-0.5">Unload your buzzing thoughts. Gubby sorts them into bite-sized tasks.</p>
          </div>
        </div>

        {/* Suggestion Templates */}
        <div className="mb-3 sm:mb-4">
          <p className="text-[10px] sm:text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wider">Try a template:</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {TEMPLATES.map((tpl, i) => (
              <button
                key={tpl.label}
                type="button"
                id={`template-btn-${i}`}
                onClick={() => handleLoadTemplate(tpl.text)}
                className="text-[11px] sm:text-xs bg-surface-sunken hover:bg-brand-soft/25 text-ink-muted border-2 border-edge-soft hover:border-brand/45 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-semibold transition-all"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>


        {/* Main Textarea */}
        <div className="relative">
          <textarea
            id="compiler-brain-dump-input"
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Laundry is piling up, email boss about the draft, car is squeaking, buy milk, renewal deadline tomorrow, I'm feeling so anxious about doing it all..."
            className="w-full h-44 p-4 rounded-2xl bg-surface-sunken border-2 border-edge-soft focus:border-brand focus:bg-surface outline-none font-nunito text-ink-2 placeholder-stone-400 transition-all text-base resize-none"
          />
          {speech.supported && (
            <button
              type="button"
              id="compiler-mic-btn"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              title={speech.listening ? "Stop dictation" : "Dictate your brain dump"}
              className={`absolute top-3 right-3 z-10 p-2 rounded-xl border-2 transition-all cursor-pointer select-none ${
                speech.listening
                  ? "bg-brand text-white border-brand animate-pulse shadow"
                  : "bg-surface  border-edge-soft  text-ink-muted  hover:text-brand"
              }`}
            >
              {speech.listening ? <Square size={16} /> : <Mic size={16} />}
            </button>
          )}
          {rawText && (
            <button
              id="clear-dump-btn"
              type="button"
              onClick={() => setRawText("")}
              className="absolute right-3 bottom-3 text-xs text-ink-muted hover:text-red-500 font-semibold bg-surface border border-edge-soft px-2 py-1 rounded-lg transition-colors shadow-sm"
            >
              Clear
            </button>
          )}
        </div>

        {/* Compile Button and Error Display */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            {error && (
              <div id="compiler-error-alert" className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-xl font-medium animate-pulse">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <button
            id="compile-dump-btn"
            type="button"
            onClick={handleCompile}
            disabled={isLoading || !rawText.trim()}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-md transition-all cursor-pointer select-none active:scale-[0.98] ${
              isLoading || !rawText.trim()
                ? "bg-surface-disabled cursor-not-allowed shadow-none"
                : "bg-brand hover:bg-brand-hover"
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Compiling Clutter...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Compile into Tasks 🪄
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading State Skeleton */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50/40 border-2 border-dashed border-edge p-8 rounded-3xl text-center space-y-3"
          >
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
              <Brain size={28} className="absolute inset-0 m-auto text-brand animate-pulse" />
            </div>
            <p className="text-ink font-bold font-fredoka text-base">Sorting the Goblin's Treasure Pile...</p>
            <p className="text-ink-muted text-sm max-w-md mx-auto">
              Gubby is dusting off your ideas, wiping away the panic, and formatting them into bite-sized actionable quests! Just a moment...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compiler Checklist Preview */}
      {tempTasks.length > 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface p-6 rounded-3xl border-2 border-edge card-shadow space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-edge">
            <div>
              <h3 className="text-lg font-bold text-ink font-fredoka flex items-center gap-2">
                Compiled Checklist Preview <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Draft Mode</span>
              </h3>
              <p className="text-xs text-ink-muted">Deselect items you don't want. Adjust titles or priorities before sending to the main list.</p>
            </div>
            
            <button
              id="send-all-todo-btn"
              onClick={handleSendToTodo}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl shadow hover:shadow-md transition-all flex items-center justify-center gap-1.5 text-sm select-none"
            >
              Send to Magic To-Do <ArrowRight size={16} />
            </button>
          </div>

          <div className="divide-y divide-stone-100 space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {tempTasks.map((task, index) => (
              <div
                key={task.id}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 first:pt-0 ${
                  task.selected ? "opacity-100" : "opacity-50"
                }`}
              >
                {/* Checkbox and Text edit */}
                <div className="flex items-start gap-3 flex-1">
                  <button
                    id={`temp-task-checkbox-${index}`}
                    role="checkbox"
                    aria-checked={task.selected}
                    aria-label={`Select task: ${task.title}`}
                    onClick={() => handleToggleSelect(index)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-1 ${
                      task.selected
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-edge-strong  bg-surface  hover:border-emerald-500"
                    }`}
                  >
                    {task.selected && <Check size={14} strokeWidth={3} />}
                  </button>

                  <div className="flex-1">
                    <input
                      id={`temp-task-title-input-${index}`}
                      type="text"
                      value={task.title}
                      onChange={(e) => handleUpdateTitle(index, e.target.value)}
                      className="w-full text-base font-semibold text-ink-2 border-b border-transparent hover:border-edge-soft focus:border-brand outline-none bg-transparent transition-colors py-0.5"
                    />

                  </div>
                </div>

                {/* Priority controls and Delete */}
                <div className="flex items-center gap-2 self-end md:self-center pl-9 md:pl-0">
                  {/* Priority Quick Buttons */}
                  <div className="flex items-center gap-1 border border-edge rounded-xl p-1 bg-surface">
                    {(["low", "medium", "high"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        id={`temp-task-${index}-priority-${lvl}`}
                        onClick={() => handleUpdatePriority(index, lvl)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all font-semibold ${
                          task.priority === lvl
                            ? getPriorityColor(lvl) + " shadow-sm font-bold"
                            : "border-transparent text-ink-muted  hover:text-ink  bg-transparent"
                        }`}
                      >
                        {lvl === "low" && "🟢"}
                        {lvl === "medium" && "🟡"}
                        {lvl === "high" && "🔴"}
                      </button>
                    ))}
                  </div>

                  {/* Delete Temporary */}
                  <button
                    id={`delete-temp-task-btn-${index}`}
                    onClick={() => handleDeleteTemp(index)}
                    className="p-2 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Discard from preview list"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface p-3 rounded-2xl flex items-center justify-between text-xs text-ink-muted">
            <span>
              💡 <strong>ADHD Tip:</strong> Adjust priority levels! High priority tasks can be broken down into tiny manageable micro-steps to get started easily.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
