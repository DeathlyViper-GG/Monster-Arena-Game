import { useEffect, useMemo, useRef, useState } from "react";
import { createVillageEngine } from "./VillageEngine";
import VillageDialogue from "./VillageDialogue";
import VillageJoystick from "./VillageJoystick";
import VillageShop from "./VillageShop";
import VillageQuestTracker from "./VillageQuestTracker";
import { SHOPS } from "./villageShop";
import {
  FOLK,
  QUARTER_FOLK,
  UNCOUNTED,
  VILLAGE_KEYS,
  foundKeys,
  rememberKey,
  claimVault,
  vaultClaimed,
} from "./villageFolk";
import { acceptQuest, claimQuest, noteKeys, noteZone, questFor, trackedQuests } from "./villageQuests";

/* ═════════════════════════════════════════════════════════════════
   HOLLOWMERE — the walkable conversation hub.

   The campaign sends its unlocked cast here; this draws the village,
   lets the player walk about, and opens a conversation when they
   reach someone. Five iron keys are dropped in the least helpful
   places in the village; all five lift the gate on the Margin
   Quarter, where the rest of the villagers have been shut in.

   The key count is owned by the host page's corner panel (the same
   slot and stacking as the announcements), so it is never covered.
   ═════════════════════════════════════════════════════════════════ */

const SHOP_PREFIX = "shop-";
const QUARTER_SHOPS = ["vesper", "cartographer"];

const SPOTS = {
  ilyra: { x: -6.6, z: 6.4, height: 3.5 },
  sable: { x: 7.4, z: 6.0, height: 3.4 },
  orrin: { x: -9.4, z: -2.2, height: 3.6 },
  maren: { x: 9.6, z: -3.0, height: 3.5 },
  vesh: { x: 3.6, z: -13.2, height: 3.9 },
  sentinel: { x: 0, z: -5.0, height: 5.4 },
  unwritten: { x: -7.6, z: -14.2, height: 4.4 },
};
const FALLBACK = [
  { x: -12, z: 11 },
  { x: 12, z: 11 },
  { x: -13, z: -9 },
  { x: 13, z: -9 },
  { x: -2.5, z: 16.5 },
  { x: 2.5, z: 16.5 },
];
// The cast, dressed as the people they are; only the uncanny ones stay hooded.
const CAST_BUILDS = {
  ilyra: "woman",
  sable: "woman",
  orrin: "elder",
  maren: "woman",
  vesh: "mystic",
  sentinel: "mystic",
  unwritten: "mystic",
};
const SHOP_BUILDS = { nissa: "keeper", odo: "man", vesper: "woman", cartographer: "man" };

export default function SentinelVillage({ cast = [], talks = {}, focusId = null, onChoose, onClose }) {
  const canvasRef = useRef(null);
  const plateRef = useRef(null);
  const engineRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [keys, setKeys] = useState(() => foundKeys());
  const [notice, setNotice] = useState(null);
  const [questTick, setQuestTick] = useState(0);

  const quarterOpen = keys.length >= VILLAGE_KEYS.length;

  const shopkeepers = useMemo(
    () =>
      SHOPS.map((shop, index) => ({
        id: SHOP_PREFIX + shop.id,
        name: shop.keeper,
        icon: shop.icon,
        accent: shop.accent,
        height: 3.2,
        x: shop.stand.x,
        z: shop.stand.z,
        seed: 31 + index,
        wander: 1.2,
        wanderSpeed: 0.8,
        variant: SHOP_BUILDS[shop.id] || "keeper",
        quarter: QUARTER_SHOPS.includes(shop.id),
      })),
    [],
  );

  const villagers = useMemo(() => {
    const people = [
      ...cast.map((persona, index) => {
        const spot = SPOTS[persona.id] || FALLBACK[index % FALLBACK.length];
        return {
          id: persona.id,
          name: persona.name,
          icon: persona.icon,
          accent: persona.accent,
          height: spot.height || 3.5,
          x: spot.x,
          z: spot.z,
          seed: index + 1,
          wander: 5,
          wanderSpeed: 1.45,
          variant: CAST_BUILDS[persona.id] || "man",
        };
      }),
      ...FOLK.map((person, index) => ({
        id: person.id,
        name: person.name,
        icon: person.icon,
        accent: person.accent,
        height: person.variant === "child" ? 3.4 : 3.3,
        x: person.spot.x,
        z: person.spot.z,
        seed: 41 + index,
        wander: person.wander,
        wanderSpeed: person.wanderSpeed,
        variant: person.variant,
      })),
      ...shopkeepers.filter((shop) => quarterOpen || !shop.quarter),
    ];

    // The shut half of the village, and the people living in it.
    if (quarterOpen) {
      people.push(
        ...QUARTER_FOLK.map((person, index) => ({
          id: person.id,
          name: person.name,
          icon: person.icon,
          accent: person.accent,
          height: person.variant === "child" ? 3.2 : 3.4,
          x: person.spot.x,
          z: person.spot.z,
          seed: 61 + index,
          wander: person.wander,
          wanderSpeed: person.wanderSpeed,
          variant: person.variant,
        })),
        {
          id: UNCOUNTED.id,
          name: UNCOUNTED.name,
          icon: UNCOUNTED.icon,
          accent: UNCOUNTED.accent,
          height: 4.2,
          x: UNCOUNTED.spot.x,
          z: UNCOUNTED.spot.z,
          seed: 77,
          wander: 0,
          wanderSpeed: 0,
          variant: UNCOUNTED.variant,
        },
      );
    }
    return people;
  }, [cast, shopkeepers, quarterOpen]);

  const personas = useMemo(() => [...cast, ...FOLK, ...QUARTER_FOLK, UNCOUNTED], [cast]);

  // One route for every approach: a stall keeper opens their cart, a villager
  // opens a conversation.
  const talkRef = useRef(() => {});
  talkRef.current = (id) => {
    if (!id) return;
    if (id.startsWith(SHOP_PREFIX)) {
      setShopId(id.slice(SHOP_PREFIX.length));
      return;
    }
    if (id === UNCOUNTED.id && !vaultClaimed()) {
      const stones = claimVault();
      setNotice(`The eighth name is real — ${stones} RuneStones in your purse, and one sentence finally ended.`);
      setQuestTick((tick) => tick + 1);
    }
    setActiveId(id);
  };

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const engine = createVillageEngine(canvasRef.current, plateRef.current, {
      onNear: setNear,
      onTalk: (id) => talkRef.current(id),
      foundKeys: foundKeys(),
      onKey: (id, count) => {
        const list = rememberKey(id);
        setKeys(list);
        noteKeys(count);
        setQuestTick((tick) => tick + 1);
        window.dispatchEvent(
          new CustomEvent("village-keys", { detail: { found: list.length, total: VILLAGE_KEYS.length } }),
        );
        const named = VILLAGE_KEYS.find((key) => key.id === id);
        setNotice(
          count >= VILLAGE_KEYS.length
            ? `${named?.name || "A key"} — that is all five. The quarter gate is lifting.`
            : `${named?.name || "A key"} found · ${count}/${VILLAGE_KEYS.length}`,
        );
      },
      onZone: (zone) => {
        noteZone(zone);
        setQuestTick((tick) => tick + 1);
      },
    });
    engineRef.current = engine;
    setReady(true);
    window.dispatchEvent(
      new CustomEvent("village-keys", { detail: { found: foundKeys().length, total: VILLAGE_KEYS.length } }),
    );
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    engineRef.current?.setNpcs(villagers);
  }, [ready, villagers]);

  // All five keys already in the satchel: the gate is standing open.
  useEffect(() => {
    if (ready && quarterOpen) engineRef.current?.setQuarterOpen(true);
  }, [ready, quarterOpen]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!ready) return;
    const engine = engineRef.current;
    const focus = activeId || (shopId ? SHOP_PREFIX + shopId : null);
    engine?.setFrozen(!!focus);
    engine?.focus(focus);
  }, [ready, activeId, shopId]);

  // Opened from a cast card: walk straight up to that villager.
  useEffect(() => {
    if (!ready || !focusId) return;
    if (!cast.some((persona) => persona.id === focusId)) return;
    setActiveId(focusId);
  }, [ready, focusId, cast]);

  const active = activeId ? personas.find((persona) => persona.id === activeId) : null;
  const activeShop = shopId ? SHOPS.find((shop) => shop.id === shopId) : null;
  const nearEntry = near ? villagers.find((person) => person.id === near) : null;
  const nearShop = nearEntry?.id?.startsWith(SHOP_PREFIX);
  const busy = !!active || !!activeShop;

  const activeQuest = useMemo(
    () => (activeId ? questFor(activeId) : null),
    [activeId, questTick],
  );
  const errands = useMemo(() => trackedQuests(), [questTick, activeId]);

  const handleAccept = (questId) => {
    acceptQuest(questId);
    setQuestTick((tick) => tick + 1);
    setNotice("Errand taken. Check the book on the left as you go.");
  };

  const handleClaim = (questId) => {
    const result = claimQuest(questId);
    setNotice(result.message);
    setQuestTick((tick) => tick + 1);
  };

  return (
    <div className="fixed inset-0 z-[105] overflow-hidden bg-[#050c0e]">
      <style>{`
        .vf-plate{position:absolute;left:0;top:0;transform:translate(-50%,-100%);
          padding:3px 9px;border-radius:999px;white-space:nowrap;pointer-events:none;
          font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
          color:#eaf6ff;background:rgba(6,12,16,.7);border:1px solid var(--plate,#9fe3ff);
          box-shadow:0 0 18px var(--plate,#9fe3ff);transition:opacity .25s ease;}
        .vf-plate span{margin-right:6px;color:var(--plate,#9fe3ff);}
      `}</style>

      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />
      <div ref={plateRef} className="pointer-events-none absolute inset-0" />

      {/* the village sign */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 md:left-6 md:top-6" data-ui>
        <div className="text-[10px] uppercase tracking-[0.42em] text-[#9fe3ff]/70">The Hearth Road</div>
        <div className="text-xl font-black tracking-[0.18em] text-white drop-shadow-[0_0_18px_rgba(159,227,255,.5)] md:text-2xl">
          HOLLOWMERE
        </div>
        <div className="mt-1 max-w-[16rem] text-[11px] leading-snug text-white/45">
          {quarterOpen
            ? "The quarter gate is open. The people behind that wall have not been out since the seals were numbered."
            : "A village drawn after the last seal was numbered — and a quarter walled off that nobody has opened since."}
        </div>
      </div>

      <button
        type="button"
        data-ui
        onClick={() => onClose?.()}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute right-3 top-3 z-20 rounded-xl border border-white/20 bg-black/50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur transition hover:bg-white/10 md:right-6 md:top-6"
      >
        Leave village
      </button>

      <VillageQuestTracker quests={errands} />

      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 w-[min(24rem,90vw)] -translate-x-1/2 rounded-xl border border-amber-300/40 bg-[linear-gradient(180deg,rgba(28,20,10,.94),rgba(10,9,16,.94))] px-4 py-2.5 text-center text-[12px] font-semibold leading-snug text-amber-100 shadow-[0_14px_40px_rgba(0,0,0,.6),0_0_28px_rgba(255,190,110,.28)]">
          {notice}
        </div>
      )}

      {/* controls hint */}
      {!busy && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 px-4 text-center text-[9px] uppercase tracking-[0.28em] text-white/30 md:bottom-5">
          WASD / arrows to walk · drag to look · E to talk · the five keys are behind things
        </div>
      )}

      {/* talk / trade prompt */}
      {!busy && nearEntry && (
        <button
          type="button"
          data-ui
          onClick={() => talkRef.current(nearEntry.id)}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute bottom-44 left-1/2 z-20 -translate-x-1/2 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-black shadow-lg transition hover:scale-105 md:bottom-24"
          style={{
            background: nearEntry.accent || "#9fe3ff",
            boxShadow: `0 0 28px ${nearEntry.accent || "#9fe3ff"}`,
          }}
        >
          {nearShop ? `Browse ${nearEntry.name}'s cart` : `Talk to ${nearEntry.name}`}
        </button>
      )}

      {!busy && <VillageJoystick onMove={(x, y) => engineRef.current?.setMove(x, y)} />}

      {active && (
        <VillageDialogue
          key={active.id}
          persona={active}
          talks={talks}
          quest={activeQuest}
          onChoose={(topicId, value) => onChoose?.(topicId, value)}
          onAcceptQuest={handleAccept}
          onClaimQuest={handleClaim}
          onClose={() => setActiveId(null)}
        />
      )}

      {activeShop && <VillageShop shop={activeShop} onClose={() => setShopId(null)} />}
    </div>
  );
}