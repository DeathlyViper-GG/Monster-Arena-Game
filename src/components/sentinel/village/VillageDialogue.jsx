import { useEffect, useMemo, useState } from "react";
import VillageQuestBlock from "./VillageQuestBlock";

/* ═════════════════════════════════════════════════════════════════
   The conversation panel — Zelda-shaped: a name, a typed line you
   click through, a topic list, and choices that stick. A villager
   with an errand offers it right here, above the topics.
   ═════════════════════════════════════════════════════════════════ */

const SPEED = 26; // characters per second

export default function VillageDialogue({
  persona,
  talks = {},
  quest = null,
  onChoose,
  onAcceptQuest,
  onClaimQuest,
  onClose,
}) {
  const [topicId, setTopicId] = useState(null);
  const [beat, setBeat] = useState(0);
  const [typed, setTyped] = useState(0);
  const [pickedLocal, setPickedLocal] = useState(null);

  const topic = useMemo(
    () => (topicId ? persona.topics?.find((t) => t.id === topicId) : null),
    [persona, topicId],
  );

  const answered = pickedLocal || (topic && talks[topic.id]) || null;

  const beats = useMemo(() => {
    if (!topic) return [{ who: persona.name, text: persona.intro }];
    const list = [...topic.lines];
    if (answered) {
      const choice = topic.choices?.find((c) => c.value === answered);
      if (choice) {
        list.push({ me: true, text: choice.label });
        (choice.reply || []).forEach((line) => list.push(line));
      }
    }
    return list;
  }, [topic, persona, answered]);

  const current = beats[Math.min(beat, beats.length - 1)] || {};
  const full = current.text || "";
  const shown = full.slice(0, typed);
  const done = typed >= full.length;

  useEffect(() => {
    setTyped(0);
  }, [beat, topicId]);

  useEffect(() => {
    if (typed >= full.length) return undefined;
    const id = setTimeout(() => setTyped((n) => n + 2), 1000 / SPEED / 2);
    return () => clearTimeout(id);
  }, [typed, full]);

  const atEnd = beat >= beats.length - 1 && done;

  const advance = () => {
    if (!done) {
      setTyped(full.length);
      return;
    }
    if (beat < beats.length - 1) setBeat((n) => n + 1);
  };

  const pick = (choice) => {
    setPickedLocal(choice.value);
    setTopicId(topic.id);
    setBeat(topic.lines.length);
    onChoose?.(topic.id, choice.value);
  };

  const openTopic = (next) => {
    setTopicId(next.id);
    setBeat(0);
    setTyped(0);
    setPickedLocal(null);
  };

  useEffect(() => {
    const onKey = (event) => {
      const tag = (event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target?.isContentEditable) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      } else if (event.key === "Enter" || event.key === " ") {
        if (!atEnd || !topic) {
          event.preventDefault();
          advance();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, atEnd, topic, advance]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-2 pb-3 md:px-8 md:pb-7" data-ui>
      <div
        onClick={advance}
        className="mx-auto w-full max-w-3xl cursor-pointer rounded-2xl border bg-black/85 px-4 py-3 shadow-[0_-10px_40px_rgba(0,0,0,.7)] backdrop-blur md:px-6 md:py-5"
        style={{ borderColor: `${persona.accent}88`, boxShadow: `0 0 40px ${persona.accent}33` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl md:text-2xl" style={{ filter: `drop-shadow(0 0 10px ${persona.accent})` }}>
            {persona.icon || "✦"}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-black tracking-wide text-white md:text-base">{persona.name}</div>
            <div className="truncate text-[9px] uppercase tracking-[0.2em] md:text-[10px]" style={{ color: persona.accent }}>
              {persona.role}
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose?.();
            }}
            className="ml-auto rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10"
          >
            Leave
          </button>
        </div>

        <p
          className={`mt-2.5 min-h-[3.2em] text-[15px] leading-relaxed md:mt-3 md:min-h-[3.6em] md:text-[17px] ${
            current.me ? "italic text-white/75" : "text-white/95"
          }`}
        >
          {current.me ? `“${shown}”` : shown}
          {!done && <span className="ml-0.5 animate-pulse">▌</span>}
        </p>

        {atEnd && (
          <div className="mt-3 flex flex-col gap-2">
            {quest && (
              <VillageQuestBlock
                quest={quest}
                accent={persona.accent}
                onAccept={onAcceptQuest}
                onClaim={onClaimQuest}
              />
            )}

            {!topic && (
              <>
                {(persona.topics || []).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openTopic(entry);
                    }}
                    className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-left text-[13px] font-semibold text-white/90 transition hover:border-white/50 hover:bg-white/[0.12]"
                  >
                    <span className="mr-2 text-[10px]" style={{ color: persona.accent }}>
                      {talks[entry.id] ? "◆" : "▸"}
                    </span>
                    {entry.label}
                  </button>
                ))}
                <span className="mt-1 text-center text-[9px] uppercase tracking-[0.3em] text-white/30">
                  Leave to keep walking
                </span>
              </>
            )}

            {topic && topic.choices && !answered && (
              <>
                {topic.choices.map((choice) => (
                  <button
                    key={choice.value + choice.label}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      pick(choice);
                    }}
                    className="rounded-xl border px-3 py-2 text-left text-[13px] font-semibold text-white transition hover:bg-white/10"
                    style={{ borderColor: `${persona.accent}55` }}
                  >
                    {choice.label}
                  </button>
                ))}
              </>
            )}

            {topic && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setTopicId(null);
                  setBeat(0);
                  setTyped(0);
                }}
                className="self-start rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55 transition hover:bg-white/10"
              >
                ‹ All topics
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}