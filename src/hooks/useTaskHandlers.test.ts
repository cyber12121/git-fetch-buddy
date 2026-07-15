import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskHandlers } from "./useTaskHandlers";
import type { Task, CalendarEvent, Habit, HabitLog } from "../types";

// Mock canvas-confetti (no jsdom canvas support) and the Google Calendar
// helpers so the hook stays pure and offline in tests.
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../lib/googleCalendar", () => ({
  createGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
}));
vi.mock("../lib/rewardHistory", () => ({ recordReward: vi.fn() }));

interface Harness {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  log: HabitLog;
  xp: number;
  toasts: Array<{ message: string }>;
}

function makeOptions(state: Harness) {
  return {
    tasks: state.tasks,
    syncTasks: (t: Task[]) => { state.tasks = t; },
    manualEvents: state.events,
    syncEvents: (e: CalendarEvent[]) => { state.events = e; },
    habits: state.habits,
    syncHabits: (h: Habit[]) => { state.habits = h; },
    habitLog: state.log,
    syncHabitLog: (l: HabitLog) => { state.log = l; },
    accessToken: null as string | null,
    setIsLoadingGoogle: vi.fn(),
    loadGoogleEvents: vi.fn(),
    addXp: (n: number) => { state.xp += n; },
    registerCombo: () => 1,
    pushToast: (t: { message: string }) => { state.toasts.push(t); },
    setGubbyMood: vi.fn(),
    setGubbyMessage: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveTaskTitle: vi.fn(),
    setActiveTaskId: vi.fn(),
    setActiveSubtaskId: vi.fn(),
  };
}

describe("useTaskHandlers", () => {
  let state: Harness;

  beforeEach(() => {
    state = {
      tasks: [],
      events: [],
      habits: [],
      log: {},
      xp: 0,
      toasts: [],
    };
  });

  it("handleAddTask appends a task locally when not connected to Google", async () => {
    const { result } = renderHook(() => useTaskHandlers(makeOptions(state)));

    await act(async () => {
      await result.current.handleAddTask("Ship the report", "high", "notes go here");
    });

    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({
      title: "Ship the report",
      priority: "high",
      notes: "notes go here",
      completed: false,
      googleEventId: undefined,
    });
    expect(state.tasks[0].estimatedMinutes).toBeGreaterThan(0);
  });

  it("handleToggleTask awards +15 XP on completion and -15 on un-complete", () => {
    state.tasks = [{
      id: "t1",
      title: "Do laundry",
      priority: "low",
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
    }];

    const { result, rerender } = renderHook(({ s }) => useTaskHandlers(makeOptions(s)), {
      initialProps: { s: state },
    });

    act(() => result.current.handleToggleTask("t1"));
    expect(state.tasks[0].completed).toBe(true);
    expect(state.xp).toBe(15);
    expect(state.toasts.some((t) => t.message.includes("+15 XP"))).toBe(true);

    rerender({ s: state });
    act(() => result.current.handleToggleTask("t1"));
    expect(state.tasks[0].completed).toBe(false);
    expect(state.xp).toBe(0);
  });

  it("handleAddHabit + handleToggleHabitDay cycles none → done (+5 XP) → skip → none", () => {
    const { result, rerender } = renderHook(({ s }) => useTaskHandlers(makeOptions(s)), {
      initialProps: { s: state },
    });

    act(() => result.current.handleAddHabit("Meditate", "#556B55"));
    expect(state.habits).toHaveLength(1);
    const id = state.habits[0].id;

    rerender({ s: state });
    act(() => result.current.handleToggleHabitDay(id, "2026-07-15"));
    expect(state.log[`${id}:2026-07-15`]).toBe("done");
    expect(state.xp).toBe(5);

    rerender({ s: state });
    act(() => result.current.handleToggleHabitDay(id, "2026-07-15"));
    expect(state.log[`${id}:2026-07-15`]).toBe("skip");
    expect(state.xp).toBe(0); // -5 when leaving "done"

    rerender({ s: state });
    act(() => result.current.handleToggleHabitDay(id, "2026-07-15"));
    expect(state.log[`${id}:2026-07-15`]).toBeUndefined();
  });

  it("handleDeleteHabit also drops log entries keyed by the habit id", () => {
    state.habits = [{ id: "h1", name: "Read", color: "#000", createdAt: "" }];
    state.log = { "h1:2026-07-15": "done", "h2:2026-07-15": "done" };

    const { result } = renderHook(() => useTaskHandlers(makeOptions(state)));
    act(() => result.current.handleDeleteHabit("h1"));

    expect(state.habits).toHaveLength(0);
    expect(state.log["h1:2026-07-15"]).toBeUndefined();
    expect(state.log["h2:2026-07-15"]).toBe("done");
  });
});
