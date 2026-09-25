import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "motion/react";

type PetalColor = "coral" | "forest" | "mossy" | "terre";

interface Task {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
}

interface FocusBloomProps {
  completedTasks: Task[];
  maxTasks: number;
  onBloomComplete?: () => void;
}

// Priority to petal color mapping
const getTaskColor = (priority: Task["priority"]): PetalColor => {
  switch (priority) {
    case "high": return "coral";
    case "medium": return "forest";
    case "low": return "mossy";
    default: return "terre";
  }
};

const petalColors: Record<PetalColor, string> = {
  coral: "#F27D26",
  forest: "#2E8B57",
  mossy: "#9ACD32",
  terre: "#DEB887",
};

// Petal component
const Petal = ({
  color,
  completed,
  index,
  style,
}: {
  color: PetalColor;
  completed: boolean;
  index: number;
  style?: React.CSSProperties;
}) => {
  const controls = useAnimation();

  useEffect(() => {
    if (completed) {
      controls.start({
        scale: [0, 1.2, 1],
        opacity: [0, 1],
        rotate: [0, 15, 0],
        transition: { duration: 0.5, delay: index * 0.1 }
      });
    }
  }, [completed, controls, index]);

  return (
    <motion.div
      animate={controls}
      initial={{ scale: 0, opacity: 0, rotate: 0 }}
      style={{
        width: 12,
        height: 18,
        backgroundColor: petalColors[color],
        borderRadius: "50% 50% 0 0",
        position: "absolute",
        left: "50%",
        top: 0,
        marginLeft: -6,
        transformOrigin: "bottom center",
        ...style,
      }}
    />
  );
};

export default function FocusBloom({
  completedTasks,
  maxTasks,
  onBloomComplete
}: FocusBloomProps) {
  const [petalCount, setPetalCount] = useState(0);
  const [isBlooming, setIsBlooming] = useState(false);
  const [bloomComplete, setBloomComplete] = useState(false);
  const controls = useAnimation();

  const completedCount = completedTasks.filter(t => t.completed).length;
  const targetPetals = Math.min(completedCount * 3, 12); // Max 12 petals

  useEffect(() => {
    if (targetPetals > petalCount && !isBlooming) {
      setIsBlooming(true);
      setPetalCount(targetPetals);
    }
  }, [targetPetals, petalCount, isBlooming]);

  useEffect(() => {
    if (isBlooming) {
      controls.start({
        scale: [0.8, 1.1, 1],
        opacity: [0.8, 1, 1],
        transition: {
          duration: 1.5,
          ease: "easeOut",
          onUpdate: (latest: any) => {
            if (onBloomComplete && latest.scale >= 1) {
              setBloomComplete(true);
              setTimeout(() => {
                setBloomComplete(false);
                setIsBlooming(false);
                onBloomComplete();
              }, 500);
            }
          }
        }
      });
    }
  }, [isBlooming, controls, onBloomComplete]);

  // Get unique colors from completed tasks
  const taskColors: PetalColor[] = completedTasks
    .filter(t => t.completed)
    .slice(0, 4) // Max 4 different colors
    .map(t => getTaskColor(t.priority));

  // Generate petal positions around a circle
  const petalPositions = Array.from({ length: 12 }).map((_, i) => ({
    angle: (i * Math.PI * 2) / 12,
    radius: 24,
  }));

  return (
    <div className="fixed bottom-20 right-20 z-50 pointer-events-none">
      <AnimatePresence>
        {petalCount > 0 && (
          <motion.div
            animate={controls}
            initial={{ scale: 0.8, opacity: 0.8 }}
            style={{
              width: 48,
              height: 48,
              position: "relative",
            }}
          >
            {/* Center bloom core */}
            <motion.div
              animate={{
                backgroundColor: bloomComplete ? "#F27D26" : "#2E8B57",
                scale: bloomComplete ? 1.2 : 1
              }}
              transition={{ duration: 0.5 }}
              style={{
                width: 24,
                height: 24,
                backgroundColor: "#2E8B57",
                borderRadius: "50%",
                position: "absolute",
                left: "50%",
                top: "50%",
                marginLeft: -12,
                marginTop: -12,
              }}
            >
              {/* Success icon */}
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="white"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
            </motion.div>

            {/* Petals */}
            {Array.from({ length: petalCount }).map((_, i) => (
              <Petal
                key={i}
                color={taskColors[i % taskColors.length] || "forest"}
                completed={targetPetals > 0}
                index={i}
                style={{
                  transform: `rotate(${petalPositions[i].angle * 180 / Math.PI}deg)`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}