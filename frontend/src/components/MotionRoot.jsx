import React from "react";
import { MotionConfig } from "framer-motion";
import useLiteMode from "../hooks/useLiteMode";

// Wraps the whole app so EVERY framer-motion animation follows the person's comfort settings (Phase 20).
//  - Normal:  reducedMotion="user"   -> animations switch off by themselves if the OS says "reduce motion"
//  - Lite mode: reducedMotion="always" -> moving/sliding animations are off, simple fades still work
export default function MotionRoot({ children }) {
  const { lite } = useLiteMode();
  return <MotionConfig reducedMotion={lite ? "always" : "user"}>{children}</MotionConfig>;
}
