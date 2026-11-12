// Fogwright Forge: hand-written data on top of the SRD (data/srd.js).
// - Backgrounds and origin feats from the 2024 Player's Handbook that are not in the free SRD: only the game numbers
//   and a short summary in our own words (look up the full text in your book).
// - Starting equipment, written out by hand (the SRD data file loses the "of your choice" items).
// - Ninth World house rules (Ninth World Toolkit/house-rules.md).
// Item ids are SRD equipment ids; anything else is shown as written. "@x" is a choice the player makes:
//   @instrument, @gaming, @artisan, @holy, @monkTool (artisan's tools or instrument), @bgTool (the background's tool).
window.EXTRA = {
  // Ninth World labels (house rules section 2)
  labels: {
    barbarian: "Glaive", fighter: "Glaive", monk: "Glaive", paladin: "Glaive",
    sorcerer: "Nano", warlock: "Nano", wizard: "Nano",
    bard: "Jack", ranger: "Jack", rogue: "Jack",
    cleric: "Tender", druid: "Tender"
  },

  classEquip: {
    barbarian: [["greataxe", ["handaxe", 4], "explorers-pack", ["gp", 15]], [["gp", 75]]],
    bard: [["leather-armor", ["dagger", 2], "@instrument", "entertainers-pack", ["gp", 19]], [["gp", 90]]],
    cleric: [["chain-shirt", "shield", "mace", "@holy", "priests-pack", ["gp", 7]], [["gp", 110]]],
    druid: [["leather-armor", "shield", "sickle", "quarterstaff", "explorers-pack", "herbalism-kit", ["gp", 9]], [["gp", 50]]],
    fighter: [["chain-mail", "greatsword", "flail", ["javelin", 8], "dungeoneers-pack", ["gp", 4]],
              ["studded-leather-armor", "scimitar", "shortsword", "longbow", ["arrows", 20], "quiver", "dungeoneers-pack", ["gp", 11]],
              [["gp", 155]]],
    monk: [["spear", ["dagger", 5], "@monkTool", "explorers-pack", ["gp", 11]], [["gp", 50]]],
    paladin: [["chain-mail", "shield", "longsword", ["javelin", 6], "@holy", "priests-pack", ["gp", 9]], [["gp", 150]]],
    ranger: [["studded-leather-armor", "scimitar", "shortsword", "longbow", ["arrows", 20], "quiver", "sprig-of-mistletoe", "explorers-pack", ["gp", 7]], [["gp", 150]]],
    rogue: [["leather-armor", ["dagger", 2], "shortsword", "shortbow", ["arrows", 20], "quiver", "thieves-tools", "burglars-pack", ["gp", 8]], [["gp", 100]]],
    sorcerer: [["spear", ["dagger", 2], "crystal", "dungeoneers-pack", ["gp", 28]], [["gp", 50]]],
    warlock: [["leather-armor", "sickle", ["dagger", 2], "orb", "book", "scholars-pack", ["gp", 15]], [["gp", 100]]],
    wizard: [[["dagger", 2], "quarterstaff", "robe", "spellbook", "scholars-pack", ["gp", 5]], [["gp", 55]]]
  },

  // Packs the SRD data file is missing
  packs: {
    "dungeoneers-pack": { n: "Dungeoneer's Pack", contents: [["backpack", 1], ["caltrops", 1], ["crowbar", 1], ["oil", 2], ["rations", 10], ["rope", 1], ["tinderbox", 1], ["torch", 10], ["waterskin", 1]] }
  },

  // Weapon training the SRD data file gets wrong (2024 rules)
  weaponProf: {
    rogue: { simple: true, martialIf: ["finesse", "light"] },
    monk: { simple: true, martialIf: ["light"] }
  },
  // Weapon Mastery: which weapons each class may pick
  masteryFrom: { barbarian: "melee", fighter: "any", paladin: "any", ranger: "any", rogue: "proficient-finesse-light" },

  // 2024 backgrounds. src "SRD" ones also have their text in the SRD; "PHB" ones are numbers only.
  backgrounds: {
    acolyte: { n: "Acolyte", src: "SRD", abil: ["int", "wis", "cha"], feat: "magic-initiate", featCls: "cleric", skills: ["insight", "religion"], tool: "Calligrapher's Supplies",
      equip: ["calligraphers-supplies", ["book", 1, "prayers"], "@holy", ["parchment", 10], "robe", ["gp", 8]] },
    artisan: { n: "Artisan", src: "PHB", abil: ["str", "dex", "int"], feat: "crafter", skills: ["investigation", "persuasion"], tool: "@artisan",
      equip: ["@bgTool", ["pouch", 2], "clothes-travelers", ["gp", 32]] },
    charlatan: { n: "Charlatan", src: "PHB", abil: ["dex", "con", "cha"], feat: "skilled", skills: ["deception", "sleight_of_hand"], tool: "Forgery Kit",
      equip: ["forgery-kit", "costume", "clothes-fine", ["gp", 15]] },
    criminal: { n: "Criminal", src: "SRD", abil: ["dex", "con", "int"], feat: "alert", skills: ["sleight_of_hand", "stealth"], tool: "Thieves' Tools",
      equip: [["dagger", 2], "thieves-tools", "crowbar", ["pouch", 2], "clothes-travelers", ["gp", 16]] },
    entertainer: { n: "Entertainer", src: "PHB", abil: ["str", "dex", "cha"], feat: "musician", skills: ["acrobatics", "performance"], tool: "@instrument",
      equip: ["@bgTool", ["costume", 2], "mirror", "perfume", "clothes-travelers", ["gp", 11]] },
    farmer: { n: "Farmer", src: "PHB", abil: ["str", "con", "wis"], feat: "tough", skills: ["animal_handling", "nature"], tool: "Carpenter's Tools",
      equip: ["sickle", "carpenters-tools", "healers-kit", "Iron Pot", "shovel", "clothes-travelers", ["gp", 30]] },
    guard: { n: "Guard", src: "PHB", abil: ["str", "int", "wis"], feat: "alert", skills: ["athletics", "perception"], tool: "@gaming",
      equip: ["spear", "light-crossbow", ["bolts", 20], "@bgTool", "lantern-hooded", "manacles", "quiver", "clothes-travelers", ["gp", 12]] },
    guide: { n: "Guide", src: "PHB", abil: ["dex", "con", "wis"], feat: "magic-initiate", featCls: "druid", skills: ["stealth", "survival"], tool: "Cartographer's Tools",
      equip: ["shortbow", ["arrows", 20], "cartographer-tools", "bedroll", "quiver", "tent", "clothes-travelers", ["gp", 3]] },
    hermit: { n: "Hermit", src: "PHB", abil: ["con", "wis", "cha"], feat: "healer", skills: ["medicine", "religion"], tool: "Herbalism Kit",
      equip: ["quarterstaff", "herbalism-kit", "bedroll", ["book", 1, "philosophy"], "lamp", ["oil", 3], "clothes-travelers", ["gp", 16]] },
    merchant: { n: "Merchant", src: "PHB", abil: ["con", "int", "cha"], feat: "lucky", skills: ["animal_handling", "persuasion"], tool: "Navigator's Tools",
      equip: ["navigators-tools", ["pouch", 2], "clothes-travelers", ["gp", 22]] },
    noble: { n: "Noble", src: "PHB", abil: ["str", "int", "cha"], feat: "skilled", skills: ["history", "persuasion"], tool: "@gaming",
      equip: ["@bgTool", "clothes-fine", "perfume", ["gp", 29]] },
    sage: { n: "Sage", src: "SRD", abil: ["con", "int", "wis"], feat: "magic-initiate", featCls: "wizard", skills: ["arcana", "history"], tool: "Calligrapher's Supplies",
      equip: ["quarterstaff", "calligraphers-supplies", ["book", 1, "history"], ["parchment", 8], "robe", ["gp", 8]] },
    sailor: { n: "Sailor", src: "PHB", abil: ["str", "dex", "wis"], feat: "tavern-brawler", skills: ["acrobatics", "perception"], tool: "Navigator's Tools",
      equip: ["dagger", "navigators-tools", "rope", "clothes-travelers", ["gp", 20]] },
    scribe: { n: "Scribe", src: "PHB", abil: ["dex", "int", "wis"], feat: "skilled", skills: ["investigation", "perception"], tool: "Calligrapher's Supplies",
      equip: ["calligraphers-supplies", "clothes-fine", "lamp", ["oil", 3], ["parchment", 12], ["gp", 23]] },
    soldier: { n: "Soldier", src: "SRD", abil: ["str", "dex", "con"], feat: "savage-attacker", skills: ["athletics", "intimidation"], tool: "@gaming",
      equip: ["spear", "shortbow", ["arrows", 20], "@bgTool", "healers-kit", "quiver", "clothes-travelers", ["gp", 14]] },
    wayfarer: { n: "Wayfarer", src: "PHB", abil: ["dex", "wis", "cha"], feat: "lucky", skills: ["insight", "stealth"], tool: "Thieves' Tools",
      equip: [["dagger", 2], "thieves-tools", "@gaming", "bedroll", ["pouch", 2], "clothes-travelers", ["gp", 16]] }
  },

  // Origin feats from the PHB that the SRD lacks: short summaries, not the book text.
  feats: {
    crafter: { n: "Crafter", type: "origin", src: "PHB",
      t: "**Tool Proficiency.** You gain proficiency with three Artisan's Tools of your choice.\n**Discount.** You pay 20% less for nonmagical items.\n**Fast Crafting.** After a Long Rest you can craft one piece of gear tied to one of those tools; it lasts until your next Long Rest. (See the Player's Handbook for the list.)",
      choose: { tools: 3, from: "artisan" } },
    healer: { n: "Healer", type: "origin", src: "PHB",
      t: "**Battle Medic.** With a Healer's Kit, as a Utilize action you can spend one use and let a creature within 5 ft spend a Hit Die: it regains that roll plus your Proficiency Bonus.\n**Healing Rerolls.** When you roll for healing with this feat or a spell, you can reroll any 1s once. (See the Player's Handbook.)" },
    lucky: { n: "Lucky", type: "origin", src: "PHB", uses: ["pb", "long", "Luck Points"],
      t: "**Luck Points.** You have Luck Points equal to your Proficiency Bonus, regained on a Long Rest.\n**Advantage.** Spend 1 to give yourself Advantage on a d20 Test.\n**Disadvantage.** Spend 1 to give Disadvantage to an attack roll against you. (See the Player's Handbook.)" },
    musician: { n: "Musician", type: "origin", src: "PHB",
      t: "**Instrument Training.** You gain proficiency with three Musical Instruments of your choice.\n**Encouraging Song.** After a Short or Long Rest, play a song and give Heroic Inspiration to allies who heard it, up to your Proficiency Bonus. (See the Player's Handbook.)",
      choose: { tools: 3, from: "instrument" } },
    "tavern-brawler": { n: "Tavern Brawler", type: "origin", src: "PHB",
      t: "**Enhanced Unarmed Strike.** Your Unarmed Strike deals 1d4 + Str Bludgeoning damage.\n**Damage Rerolls.** Reroll 1s on the damage dice of your Unarmed Strikes once.\n**Improvised Weaponry.** You are proficient with improvised weapons.\n**Push.** Once per turn, when you hit with an Unarmed Strike as part of the Attack action, you can also push the target 5 ft. (See the Player's Handbook.)" },
    tough: { n: "Tough", type: "origin", src: "PHB", hpPerLevel: 2,
      t: "Your Hit Point maximum increases by twice your character level when you gain this feat, and by 2 more each time you gain a level after that." }
  },

  // Fixed parts of the SRD origin feats the builder needs to know
  featRules: {
    alert: { init: "pb" },
    skilled: { choose: { any: 3 } },
    "magic-initiate": { magicInitiate: true },
    "savage-attacker": {}
  },

  divineOrder: {
    protector: { n: "Protector", t: "Proficiency with Martial weapons and training with Heavy armor." },
    thaumaturge: { n: "Thaumaturge", t: "One extra Cleric cantrip, and a bonus equal to your Wisdom modifier (min +1) on Intelligence (Arcana or Religion) checks." }
  },
  primalOrder: {
    magician: { n: "Magician", t: "One extra Druid cantrip, and a bonus equal to your Wisdom modifier (min +1) on Intelligence (Arcana or Nature) checks." },
    warden: { n: "Warden", t: "Proficiency with Martial weapons and training with Medium armor." }
  },

  // Ninth World names for the 2024 languages (Lantern Marches world/languages.md). [name, 5e language]
  // Rule unchanged: the Truth (Common) + two standard languages; rare ones only from features or the GM.
  languages: {
    standard: [["Battle-sign", "Common Sign Language"], ["Marcher speech", "Halfling"], ["Southern trade-cant", "Goblin"], ["Drill", "Orc"],
      ["Hall-tongue", "Elvish"], ["Ashtongue", "Draconic"], ["Holdspeech", "Dwarvish"], ["Tick", "Gnomish"], ["Reedtalk", "Giant"]],
    rare: [["Lamp-liturgy", "Celestial"], ["Machine-speech", "Deep Speech"], ["Mender-cant", "Infernal"], ["Void-whisper", "Abyssal"],
      ["Weather-speech", "Primordial"], ["Greensong", "Sylvan"], ["Root-sign", "Druidic"], ["Gutter-cant", "Thieves' Cant"], ["Lowtongue", "Undercommon"]],
    common: "the Truth"
  },

  // Uses per rest for class features at level 1-2 (the rest comes in the level-up phase)
  uses: {
    "barbarian-rage": ["cs:rage_count", "long", "Rage"],
    "fighter-second-wind": ["cs:second_wind_uses", "long", "Second Wind"],
    "bard-bardic-inspiration": ["mod:cha", "long", "Bardic Inspiration"],
    "paladin-lay-on-hands": ["lv5", "long", "Lay on Hands (HP pool)"],
    "cleric-channel-divinity": ["cs:channel_divinity_charges", "short", "Channel Divinity"],
    "paladin-channel-divinity": ["cs:channel_divinity_charges", "short", "Channel Divinity"],
    "druid-wild-shape": ["cs:wild_shape_uses", "long", "Wild Shape"],
    "monk-monks-focus": ["cs:focus_points", "short", "Focus Points"],
    "sorcerer-font-of-magic": ["cs:sorcery_points", "long", "Sorcery Points"],
    "sorcerer-innate-sorcery": [2, "long", "Innate Sorcery"],
    "wizard-arcane-recovery": [1, "long", "Arcane Recovery"],
    "warlock-magical-cunning": [1, "long", "Magical Cunning"],
    "ranger-favored-enemy": ["cs:favored_enemies", "long", "Favored Enemy (free Hunter's Mark)"]
  },

  house: {
    money: "shins",
    cypherLimit: "Cypher limit: you can carry Proficiency Bonus + 1 cyphers ({n}). At the end of each Long Rest, roll a d6 for each cypher over the limit; on a 1, one of them (GM's choice) goes off or crumbles.",
    intrusion: "GM intrusions: accept one and gain Heroic Inspiration; refuse one by spending Heroic Inspiration you already have."
  }
};
