import React from "react";
import { Link } from "react-router-dom";
import AnnouncementsCorner from "@/components/announcements/AnnouncementsCorner";

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnnouncementsCorner />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to game
        </Link>
        <h1 className="text-4xl font-heading font-bold mt-6 mb-6">About Monster Arena</h1>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground font-body">
          <p>
            Monster Arena is an intense fantasy action survival game where you master
            magical glyphs to outlast escalating waves of intelligent enemies. Across five
            themed realms — from the verdant Heartwood to the cursed Sunken Dunes and beyond —
            you explore buildings, uncover hidden chests, and adapt as the arena itself turns
            lethal with quicksand, lava, void, and ice hazards. Death is punishing: it strips
            your powerful enchantments, forcing you to earn your magic back every time you
            respawn.
          </p>
          <p>
            The game is built for action fans who enjoy skill-based combat, deep upgrade
            systems, and replayable runs. Play offline against AI bots, tackle singleplayer
            waves at your own pace, or join a multiplayer lobby for co-op PvE survival or
            free-for-all PvP. A full plot-driven Story mode weaves cinematic cutscenes, mid-
            combat villain dialogue, and branching endings through every realm.
          </p>
          <p>
            Monster Arena is developed and published on the Base44 platform, which provides
            the hosting, authentication, and backend services that power multiplayer lobbies
            and persistent progress. Have feedback or a bug to report? Visit our{" "}
            <Link to="/contact" className="underline text-foreground hover:opacity-80">
              Contact page
            </Link>
            .
          </p>
          <p className="text-base border-t border-border pt-6 mt-8">
            <strong className="text-foreground">Licence and ownership.</strong> Monster Arena,
            including its code, artwork, audio, story and the Monster Arena name and logo, is
            proprietary and protected by copyright. You may play the game and share a link to it;
            you may not copy, re-host, redistribute, modify, reverse engineer or commercially
            exploit it without written permission. All rights reserved.
          </p>
          <p className="text-base">
            <strong className="text-foreground">No copying, cloning or remixing.</strong> Making a
            copy of this game is not permitted. That includes cloning, remixing or copying the app
            through any app-builder, no-code or AI platform feature, forking its code, or
            republishing it under another name — even though the game can be opened and played by
            anyone with the link. Being publicly viewable is not permission to copy it. The full
            terms are in the game's licence; permission for any copy must be given by the owner in
            writing.
          </p>
          <p className="text-sm text-muted-foreground/70">
            © 2026 Monster Arena. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}