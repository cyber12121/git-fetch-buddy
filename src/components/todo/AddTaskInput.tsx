import { memo } from "react";
import { AlertCircle, Mic, Plus, Sparkles, Square } from "lucide-react";
import { estimateTaskDuration } from "../../lib/constants";
import { useSpeechRecognition } from "../../lib/useSpeechRecognition";

interface Props {
  newTitle: string;
  setNewTitle: (v: string) => void;
  priorityVal: number;
  onPriorityChange: (v: number) => void;
  formError: string | null;
  setFormError: (v: string | null) => void;
  onSubmit: () => void;
  onVoiceResult: (text: string) => void;
}

/**
 * Inline task composer: title input, priority pills (desktop + mobile),
 * optional voice dictation, and an auto-estimate hint. Owns only its
 * speech-recognition subscription; all form state lives in useMagicTodo.
 */
function AddTaskInputImpl(p: Props) {
  const speech = useSpeechRecognition(p.onVoiceResult);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); p.onSubmit(); }}
      className="mb-5"
    >
      <div className="group flex items-stretch gap-0 bg-surface-sunken border border-edge rounded-2xl overflow-hidden focus-within:border-brand transition-colors">
        <div className="flex items-center pl-4 text-ink-muted">
          <Plus size={18} />
        </div>
        <input
          id="todo-title-input"
          type="text"
          value={p.newTitle}
          onChange={(e) => { p.setNewTitle(e.target.value); if (p.formError) p.setFormError(null); }}
          placeholder="Add a quest… what feels too big?"
          className="flex-1 min-w-0 px-3 py-3.5 bg-transparent outline-none font-nunito text-ink placeholder:text-ink-muted/70 text-base"
        />
        {/* priority pills */}
        <div className="hidden sm:flex items-center gap-1 px-2 border-l border-edge-soft">
          {[1, 2, 3].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => p.onPriorityChange(v)}
              className={`w-8 h-8 rounded-lg text-base transition-all cursor-pointer ${p.priorityVal === v ? "bg-brand-soft scale-110" : "hover:bg-surface"}`}
              title={v === 1 ? "Low" : v === 2 ? "Medium" : "High"}
            >
              {v === 1 ? "🟢" : v === 2 ? "🟡" : "🔴"}
            </button>
          ))}
        </div>
        {speech.supported && (
          <button
            type="button"
            id="todo-mic-btn"
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            className={`px-3 border-l border-edge-soft transition-colors cursor-pointer ${speech.listening ? "bg-brand text-primary-foreground animate-pulse" : "text-ink-muted hover:text-brand"}`}
            title={speech.listening ? "Stop dictation" : "Dictate"}
          >
            {speech.listening ? <Square size={16} /> : <Mic size={16} />}
          </button>
        )}
        <button
          id="add-todo-btn"
          type="submit"
          className="px-5 bg-brand hover:bg-brand-hover text-primary-foreground font-bold text-sm transition-colors cursor-pointer"
        >
          Add
        </button>
      </div>

      {/* mobile priority row */}
      <div className="sm:hidden mt-2 flex items-center gap-1">
        {[1, 2, 3].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => p.onPriorityChange(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer border ${p.priorityVal === v ? "bg-brand-soft border-brand/40 text-ink" : "border-edge-soft text-ink-muted"}`}
          >
            {v === 1 ? "🟢 Low" : v === 2 ? "🟡 Med" : "🔴 High"}
          </button>
        ))}
      </div>

      {p.formError ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-danger font-semibold">
          <AlertCircle size={14} /> {p.formError}
        </div>
      ) : p.newTitle.trim() && (
        <div className="mt-2 text-[11px] text-ink-muted font-semibold flex items-center gap-1.5">
          <Sparkles size={11} className="text-brand" /> Auto-estimate: <span className="font-mono text-brand">{estimateTaskDuration(p.newTitle)}m</span>
        </div>
      )}
    </form>
  );
}

export default memo(AddTaskInputImpl);
