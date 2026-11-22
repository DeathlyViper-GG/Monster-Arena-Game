import { createArrivalOne, createArrivalTwo, createArrivalThree } from "./ArrivalFilm";
import { createShrineOne, createShrineTwo, createShrineThree } from "./ShrineFilm";
import { createKeepOne, createKeepTwo, createKeepThree } from "./KeepFilm";
import { createDawnOne, createDawnTwo, createDawnThree } from "./DawnFilm";
import { createCryoOne, createCryoTwo, createCryoThree } from "./CryoFilm";

/* The four films Crysto tells: the arrival, the waking of the shrines, the
   Hollow Knight and the dawn it was all for. Each is three beats of real
   three.js sets, played through the same cinematic shell as the realm
   intros and the Age of the Sentinel. */
const FILMS = {
  cryo: {
    scenes: [
      {
        numeral: "I",
        caption:
          "Cold first. Then the sound of your own heart, and a light stuttering red through a hand's width of ice.",
      },
      {
        numeral: "II",
        caption:
          "The frost runs off the glass in slow lines. Beyond it, someone has been keeping a light on for a very long time.",
      },
      {
        numeral: "III",
        caption:
          "The hatch lets go. The air that comes in is warm, and green, and full of smoke from a village you have never seen.",
      },
    ],
    builders: [createCryoOne, createCryoTwo, createCryoThree],
    tint: 0xbfe4ff,
    accent: "#e8f6ff",
    endHint: "walk into the vale",
  },

  arrival: {
    scenes: [
      {
        numeral: "I",
        caption:
          "Beyond the pod there is a country the arena has no name for — green hills under a single warm sun, and a valley with smoke coming off its roofs.",
      },
      {
        numeral: "II",
        caption:
          "Drane Vale. They have kept their lamps lit for a thousand years, waiting for someone to come back through the door.",
      },
      {
        numeral: "III",
        caption:
          "But the Sunstone that kept them warm has gone dark, and it lies in the Sunken Keep with something standing over it. Wake the three shrines — and bring the light home.",
      },
    ],
    builders: [createArrivalOne, createArrivalTwo, createArrivalThree],
    tint: 0xffd9a8,
    accent: "#fff1d6",
    endHint: "step into crysto",
  },

  shrine: {
    scenes: [
      {
        numeral: "I",
        caption: "The last shrine has slept so long the moss has taken the steps.",
      },
      {
        numeral: "II",
        caption: "One word from a living hand, and the stone remembers what it was for.",
      },
      {
        numeral: "III",
        caption:
          "Three lights in the dark — Root, Ember and Tide. The vale breathes again, and the road east opens.",
      },
    ],
    builders: [createShrineOne, createShrineTwo, createShrineThree],
    tint: 0x9dffc0,
    accent: "#e2ffe9",
    endHint: "walk east",
  },

  keep: {
    scenes: [
      {
        numeral: "I",
        caption:
          "The Sunken Keep. Its gate has stood open since the Sunstone went out, and nothing has come back through it.",
      },
      {
        numeral: "II",
        caption: "This hall was built to hold a light. Something else has been holding it.",
      },
      {
        numeral: "III",
        caption:
          "The Hollow Knight — waiting a thousand years for someone to walk in and take the stone out of its hands.",
      },
    ],
    builders: [createKeepOne, createKeepTwo, createKeepThree],
    tint: 0x9a6ad8,
    accent: "#ecd9ff",
    endHint: "raise your blade",
  },

  dawn: {
    scenes: [
      {
        numeral: "I",
        caption: "Cold iron, cold stone, and a heart that stopped listening.",
      },
      {
        numeral: "II",
        caption: "Light answers light. The Sunstone remembers the hand that set it here.",
      },
      {
        numeral: "III",
        caption:
          "And Crysto wakes — every field, every roof, every road it kept dark for you.",
      },
    ],
    builders: [createDawnOne, createDawnTwo, createDawnThree],
    tint: 0xffe6b0,
    accent: "#fff6e2",
    endHint: "return to the vale",
  },
};

export default FILMS;