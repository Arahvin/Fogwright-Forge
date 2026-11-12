// The Artificer, from Unearthed Arcana 2024 "The Artificer" (playtest material, (c) Wizards of the Coast).
// Not part of the free SRD: here are only the numbers and short summaries in our own words. Read the UA PDF for the full text.
// Allowed in the Lantern Marches by the GM. Loaded after srd.js and merged into it by js/rules.js.
window.ARTIFICER = (function () {
  const slots = (...a) => a.concat([0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 9);
  const table = [
    // level: cantrips, prepared, slots, plans, magic items
    [2, 2, slots(2), 0, 0], [2, 3, slots(2), 4, 2], [2, 4, slots(3), 4, 2], [2, 5, slots(3), 4, 2],
    [2, 6, slots(4, 2), 4, 2], [2, 6, slots(4, 2), 5, 3], [2, 7, slots(4, 3), 5, 3], [2, 7, slots(4, 3), 5, 3],
    [2, 9, slots(4, 3, 2), 5, 3], [3, 9, slots(4, 3, 2), 6, 4], [3, 10, slots(4, 3, 3), 6, 4], [3, 10, slots(4, 3, 3), 6, 4],
    [3, 11, slots(4, 3, 3, 1), 6, 4], [4, 11, slots(4, 3, 3, 1), 7, 5], [4, 12, slots(4, 3, 3, 2), 7, 5], [4, 12, slots(4, 3, 3, 2), 7, 5],
    [4, 14, slots(4, 3, 3, 3, 1), 7, 5], [4, 14, slots(4, 3, 3, 3, 1), 8, 6], [4, 15, slots(4, 3, 3, 3, 2), 8, 6], [4, 15, slots(4, 3, 3, 3, 2), 8, 6]
  ];
  const feats = {
    1: ["artificer-magical-tinkering", "artificer-spellcasting"], 2: ["artificer-replicate-magic-item"],
    3: ["artificer-subclass", "artificer-right-tool-for-the-job"], 4: ["artificer-ability-score-improvement"],
    6: ["artificer-magic-item-tinker"], 7: ["artificer-flash-of-genius"], 8: ["artificer-ability-score-improvement"],
    10: ["artificer-magic-item-adept"], 11: ["artificer-spell-storing-item"], 12: ["artificer-ability-score-improvement"],
    14: ["artificer-magic-item-savant"], 16: ["artificer-ability-score-improvement"], 18: ["artificer-magic-item-master"],
    19: ["artificer-epic-boon"], 20: ["artificer-soul-of-artifice"]
  };
  const lv = {};
  table.forEach((r, i) => {
    lv[i + 1] = { f: feats[i + 1] || [], cs: { plans_known: r[3], magic_items: r[4] }, can: r[0], prep: r[1], slots: r[2] };
  });
  const F = (n, l, t, sub) => ({ n, cls: "artificer", lv: l, sub: sub || "", t });

  return {
    cls: {
      n: "Artificer", hd: 8, saves: ["con", "int"], src: "UA 2024",
      prof: ["light-armor", "medium-armor", "shields", "simple-weapons", "tool-thieves-tools", "tool-tinkers-tools"],
      skills: { n: 2, from: ["arcana", "history", "investigation", "medicine", "nature", "perception", "sleight_of_hand"] },
      tools: [{ n: 1, desc: "One type of Artisan's Tools of your choice", from: [] }],
      equip: { desc: "", options: [] }, cast: "int", lv, subs: ["alchemist", "armorer", "artillerist", "battle-smith"],
      mc: { pre: [["int", 13]], prof: ["light-armor", "medium-armor", "shields"] }
    },
    equip: [["studded-leather-armor", "dagger", "thieves-tools", "tinkers-tools", "dungeoneers-pack", ["gp", 16]], [["gp", 150]]],
    label: "Nano",
    features: {
      "artificer-magical-tinkering": F("Magical Tinkering", 1,
        "As a Magic action while holding Tinker's Tools, you make one ordinary item appear in an empty space within 5 ft: Ball Bearings, Basket, Bedroll, Bell, Blanket, Block and Tackle, Bucket, Caltrops, Candle, Crowbar, Flask, Jug, Lamp, Net, Oil, Paper, Parchment, Pole, Pouch, Rope, Sack, Shovel, String, Tinderbox, Torch or Vial. It vanishes after 1 hour.\n\nUses: your Intelligence modifier (minimum 1), regained on a Long Rest."),
      "artificer-spellcasting": F("Spellcasting", 1,
        "You cast Artificer spells through tools: Thieves' Tools, Tinker's Tools or Artisan's Tools you are proficient with are your Spellcasting Focus, and you must hold one to cast an Artificer spell. Intelligence is your spellcasting ability.\n\n**Cantrips.** You know two (Acid Splash and Prestidigitation are suggested). After each Long Rest you can swap one. You learn more at levels 10 and 14.\n**Prepared spells.** Start with two level 1 Artificer spells (Cure Wounds and Grease are suggested); the number grows with the table. After each Long Rest you can change the list.\n**Slots.** Half-caster slots (see the Artificer table), regained on a Long Rest."),
      "artificer-replicate-magic-item": F("Replicate Magic Item", 2,
        "You learn magic item plans (4 at level 2, more later) from the Artificer plan lists: at level 2 Alchemy Jug, Bag of Holding, Cap of Water Breathing, a Common item (not a Potion, Scroll or cursed), Goggles of Night, Rope of Climbing, Sending Stones, Shield +1, Wand of Magic Detection, Wand of Secrets, Wand of the War Mage +1 or Weapon +1. Each level you can swap one plan.\n\nAfter a Long Rest with Tinker's Tools in hand, you create one or two items from your plans (more at higher levels). They work like the real item; if you go over your limit the oldest vanishes, and they vanish 1d4 days after you die. You can attune to a new item the moment you make it."),
      "artificer-subclass": F("Artificer Subclass", 3, "Choose a subclass: Alchemist, Armorer, Artillerist or Battle Smith."),
      "artificer-right-tool-for-the-job": F("Right Tool for the Job", 3, "Magical Tinkering can now also make Artisan's Tools."),
      "artificer-ability-score-improvement": F("Ability Score Improvement", 4, "Take the Ability Score Improvement feat or another feat you qualify for. Again at levels 8, 12 and 16."),
      "artificer-magic-item-tinker": F("Magic Item Tinker", 6,
        "**Drain Magic Item.** Bonus Action, once per Long Rest: touch an item you made with Replicate Magic Item within 5 ft; it vanishes and becomes a spell slot (level 1 for Common, level 2 for Uncommon or Rare) that lasts until your next Long Rest.\n**Expanded Replication.** You can learn plans from the level 6+ list (Armor +1, Boots of Elvenkind, Cloak of Elvenkind, Cloak of the Manta Ray, Eyes of Charming, Gloves of Thievery, Lantern of Revealing, Pipes of Haunting, an Uncommon armor, wand or weapon)."),
      "artificer-flash-of-genius": F("Flash of Genius", 7,
        "When you or a creature you can see within 30 ft fails an ability check or saving throw, you can take a Reaction to add your Intelligence modifier to the roll. Uses: Intelligence modifier (min 1) per Long Rest."),
      "artificer-magic-item-adept": F("Magic Item Adept", 10, "You can attune to four magic items at once, and learn plans from the level 10+ list (Uncommon rings and wondrous items)."),
      "artificer-spell-storing-item": F("Spell-Storing Item", 11,
        "After a Long Rest, store a level 1-3 Artificer spell with a casting time of an action in a weapon or focus you touch. Whoever holds it can take an action to cast it with your modifier, up to twice your Intelligence modifier times (min 2)."),
      "artificer-magic-item-savant": F("Magic Item Savant", 14, "You can attune to five magic items, learn plans from the level 14+ list (Rare items), and have at most three Rare replicated items at a time."),
      "artificer-magic-item-master": F("Magic Item Master", 18, "You can attune to six magic items at once."),
      "artificer-epic-boon": F("Epic Boon", 19, "Take an Epic Boon feat or another feat you qualify for (Boon of Energy Resistance is suggested)."),
      "artificer-soul-of-artifice": F("Soul of Artifice", 20,
        "**Cheat Death.** When you drop to 0 HP and aren't killed outright, you can destroy one Uncommon or Rare item you made with Replicate Magic Item and go to 20 HP instead.\n**Magical Guidance.** While attuned to at least one magic item, once per turn you can add 1d6 to an ability check after rolling.")
    },
    uses: {
      "artificer-magical-tinkering": ["mod:int", "long", "Magical Tinkering"],
      "artificer-flash-of-genius": ["mod:int", "long", "Flash of Genius"],
      "artificer-magic-item-tinker": [1, "long", "Drain Magic Item"]
    },
    subclasses: {
      alchemist: { n: "Alchemist", cls: "artificer", sum: "Craft magic elixirs and potions", t: "", f: [
        { n: "Tool Proficiency", lv: 3, t: "Proficiency with Alchemist's Supplies (or another Artisan's Tools if you have it). Brewing potions takes half the time." },
        { n: "Alchemist Spells", lv: 3, t: "Always prepared: 3 Healing Word, Ray of Sickness; 5 Flaming Sphere, Acid Arrow; 9 Gaseous Form, Mass Healing Word; 13 Death Ward, Vitriolic Sphere; 17 Cloudkill, Raise Dead.", spells: { 3: ["healing-word", "ray-of-sickness"], 5: ["flaming-sphere", "acid-arrow"], 9: ["gaseous-form", "mass-healing-word"], 13: ["death-ward", "vitriolic-sphere"], 17: ["cloudkill", "raise-dead"] } },
        { n: "Experimental Elixir", lv: 3, t: "After a Long Rest with Alchemist's Supplies you make two elixirs (three at 5, four at 9, five at 15), rolling d6 for each: 1 Healing (2d8 + Int HP), 2 Swiftness (+10 ft Speed, 1 hour), 3 Resilience (+1 AC, 10 min), 4 Boldness (+1d4 to attacks and saves, 1 min), 5 Flight (Fly 10 ft, 10 min), 6 choose. Drinking one is a Bonus Action. As a Magic action you can spend a spell slot to make another (you choose the effect). Unused elixirs vanish at your next Long Rest." },
        { n: "Alchemical Savant", lv: 5, t: "When you cast a spell through Alchemist's Supplies, add your Intelligence modifier (min +1) to one healing roll or one Acid, Fire, Necrotic or Poison damage roll." },
        { n: "Restorative Reagents", lv: 9, t: "Anyone drinking your elixir also gains Temporary HP equal to your Int modifier + Artificer level. You can cast Lesser Restoration without a slot, Int modifier times (min 1) per Long Rest." },
        { n: "Chemical Mastery", lv: 15, t: "Once per turn, an Artificer spell dealing Acid, Fire, Necrotic or Poison damage also deals 2d8 Force. Resistance to Acid and Poison. Cast Tasha's Bubbling Cauldron once per Long Rest without a slot or components." }
      ] },
      armorer: { n: "Armorer", cls: "artificer", sum: "Craft magic armor to enhance your abilities", t: "", f: [
        { n: "Tools of the Trade", lv: 3, t: "Training with Heavy armor and proficiency with Smith's Tools (or another Artisan's Tools). Crafting armor takes half the time." },
        { n: "Armorer Spells", lv: 3, t: "Always prepared: 3 Magic Missile, Thunderwave; 5 Mirror Image, Shatter; 9 Hypnotic Pattern, Lightning Bolt; 13 Fire Shield, Greater Invisibility; 17 Passwall, Wall of Force.", spells: { 3: ["magic-missile", "thunderwave"], 5: ["mirror-image", "shatter"], 9: ["hypnotic-pattern", "lightning-bolt"], 13: ["fire-shield", "greater-invisibility"], 17: ["passwall", "wall-of-force"] } },
        { n: "Arcane Armor", lv: 3, t: "Magic action with Smith's Tools: the armor you wear becomes Arcane Armor. No Strength requirement, don or doff as a Utilize action, can't be removed against your will, covers your whole body (helmet as a Bonus Action), replaces missing limbs, and is a Spellcasting Focus." },
        { n: "Armor Model", lv: 3, t: "Choose a model (change it on a Short or Long Rest with Smith's Tools). Its special weapon uses Intelligence for attack and damage.\n**Dreadnaught:** Armor Flail (Simple Melee, 1d10 Bludgeoning, Reach); Giant Stature (Bonus Action, 1 min: +5 ft reach, become Large; Int mod uses per Long Rest); Wrecking Ball (push or pull a smaller creature 10 ft on a hit).\n**Guardian:** Thunder Gauntlets (Simple Melee, 1d8 Thunder; a target hit has Disadvantage on attacks against others until your next turn); Defensive Field (while Bloodied, Bonus Action: Temporary HP equal to your Artificer level).\n**Infiltrator:** Lightning Launcher (Simple Ranged, 1d6 Lightning, Thrown 90/300; once per turn +1d6 Lightning on a hit); Powered Steps (+5 ft Speed); Dampening Field (Advantage on Stealth checks)." },
        { n: "Extra Attack", lv: 5, t: "You attack twice when you take the Attack action." },
        { n: "Armor Replication", lv: 9, t: "Learn one extra Armor plan for Replicate Magic Item and create one extra item, which must be armor." },
        { n: "Perfected Armor", lv: 15, t: "Dreadnaught: flail 2d6, Giant Stature gives +10 ft reach, Large or Huge, and a Fly Speed. Guardian: gauntlets 1d10, and as a Reaction (Int mod times per Long Rest) pull a creature ending its turn within 30 ft up to 25 ft toward you (Str save) and attack it. Infiltrator: launcher 2d6; a creature hit glimmers (Dim Light 5 ft, Disadvantage on attacks against you)." }
      ] },
      artillerist: { n: "Artillerist", cls: "artificer", sum: "Wield destructive power from afar", t: "", f: [
        { n: "Tool Proficiency", lv: 3, t: "Proficiency with Woodcarver's Tools (or another Artisan's Tools). Crafting magic Wands takes half the time." },
        { n: "Artillerist Spells", lv: 3, t: "Always prepared: 3 Shield, Thunderwave; 5 Scorching Ray, Shatter; 9 Fireball, Wind Wall; 13 Ice Storm, Wall of Fire; 17 Cone of Cold, Wall of Force.", spells: { 3: ["shield", "thunderwave"], 5: ["scorching-ray", "shatter"], 9: ["fireball", "wind-wall"], 13: ["ice-storm", "wall-of-fire"], 17: ["cone-of-cold", "wall-of-force"] } },
        { n: "Eldritch Cannon", lv: 3, t: "Magic action with Woodcarver's or Smith's Tools: create a Small or Tiny Eldritch Cannon within 5 ft (once per Long Rest, or spend a spell slot). One cannon at a time; it lasts 1 hour or until 0 HP.\n**Cannon:** AC 18, HP 5 × Artificer level (Mending heals 2d6), immune to Poison and Psychic.\n**Activate (Bonus Action, within 60 ft; it can move 15 ft):** Flamethrower (15-ft Cone, Dex save vs your DC, 2d8 Fire, half on success); Force Ballista (ranged spell attack, 120 ft, 2d8 Force and push 5 ft); Protector (it and creatures you choose within 10 ft gain 1d8 + Int Temporary HP)." },
        { n: "Arcane Firearm", lv: 5, t: "After a Long Rest, carve sigils into a Rod, Staff or Wand with Woodcarver's Tools. It is a Spellcasting Focus, and an Artificer spell cast through it adds 1d8 to one damage roll." },
        { n: "Explosive Cannon", lv: 9, t: "Cannon damage rolls +1d8. When the cannon drops to 0 HP within 60 ft of you, as a Reaction it explodes: 20 ft, Dex save, 3d10 Force, half on success." },
        { n: "Fortified Position", lv: 15, t: "Two cannons at once (both made with one Magic action, activated with one Bonus Action). You and allies within 10 ft of a cannon have Half Cover." }
      ] },
      "battle-smith": { n: "Battle Smith", cls: "artificer", sum: "Command a construct guardian", t: "", f: [
        { n: "Tool Proficiency", lv: 3, t: "Proficiency with Smith's Tools (or another Artisan's Tools). Crafting weapons takes half the time." },
        { n: "Battle Smith Spells", lv: 3, t: "Always prepared: 3 Heroism, Shield; 5 Shining Smite, Warding Bond; 9 Aura of Vitality, Conjure Barrage; 13 Aura of Purity, Fire Shield; 17 Banishing Smite, Mass Cure Wounds.", spells: { 3: ["heroism", "shield"], 5: ["shining-smite", "warding-bond"], 9: ["aura-of-vitality", "conjure-barrage"], 13: ["aura-of-purity", "fire-shield"], 17: ["banishing-smite", "mass-cure-wounds"] } },
        { n: "Battle Ready", lv: 3, t: "Proficiency with Martial weapons. With a magic weapon you can use Intelligence for attack and damage." },
        { n: "Steel Defender", lv: 3, t: "A construct companion (re-made after a Long Rest with Smith's Tools; revive it within an hour with a spell slot). It acts on your turn: Dodge unless you use a Bonus Action to command it.\n**Steel Defender** (Medium Construct): AC 15, HP 5 + 5 × Artificer level (d8 Hit Dice), Speed 40 ft. Str 14, Dex 12, Con 14, Int 4, Wis 10, Cha 6. Immune Poison; Charmed, Exhaustion, Poisoned. Darkvision 60 ft. Adds your PB to its checks and saves.\n**Force-Empowered Rend:** melee, your spell attack bonus, reach 5 ft, 1d8 + 2 + Int Force.\n**Repair (3/day):** it or a construct within 5 ft regains 2d8 + Int HP.\n**Deflect Attack (Reaction):** a creature within 5 ft attacking someone else has Disadvantage." },
        { n: "Extra Attack", lv: 5, t: "You attack twice when you take the Attack action." },
        { n: "Arcane Jolt", lv: 9, t: "When you hit with a magic weapon or your Steel Defender hits, once per turn: +2d6 Force, or heal a creature within 30 ft of the target 2d6. Int modifier uses (min 1) per Long Rest." },
        { n: "Improved Defender", lv: 15, t: "Arcane Jolt becomes 4d6. The defender gets +2 AC, and its Deflect Attack deals 1d4 + Int Force to the attacker." }
      ] }
    },
    // the Artificer spell list (UA 2024), as SRD spell ids
    list: ("acid-splash dancing-lights elementalism fire-bolt guidance light mage-hand mending message poison-spray prestidigitation ray-of-frost resistance shocking-grasp spare-the-dying thorn-whip thunderclap true-strike " +
      "alarm cure-wounds detect-magic disguise-self expeditious-retreat faerie-fire false-life feather-fall grease identify jump longstrider purify-food-and-drink sanctuary " +
      "aid alter-self arcane-lock arcane-vigor blur continual-flame darkvision dragons-breath enhance-ability enlarge-reduce heat-metal homunculus-servant invisibility lesser-restoration levitate magic-mouth magic-weapon protection-from-poison rope-trick see-invisibility spider-climb web " +
      "blink create-food-and-water dispel-magic elemental-weapon fly glyph-of-warding haste protection-from-energy revivify water-breathing water-walk " +
      "arcane-eye fabricate freedom-of-movement secret-chest faithful-hound private-sanctum resilient-sphere stone-shape stoneskin summon-construct " +
      "animate-objects arcane-hand circle-of-power creation greater-restoration wall-of-stone").split(" "),
    // spells on the list (or in a subclass) that the free SRD lacks: short summaries, not the book text
    spells: {
      "thorn-whip": { n: "Thorn Whip", lv: 0, sch: "Transmutation", ct: "Action", r: "30 feet", c: "V, S, M (the stem of a thorny plant)", d: "Instantaneous", conc: false, rit: false, cls: ["druid"], src: "PHB",
        t: "Melee spell attack against a creature within range: 1d6 Piercing, and if it is Large or smaller you pull it up to 10 ft toward you.", hi: "1d6 more at levels 5, 11 and 17." },
      "thunderclap": { n: "Thunderclap", lv: 0, sch: "Evocation", ct: "Action", r: "Self", c: "S", d: "Instantaneous", conc: false, rit: false, cls: ["bard", "druid", "sorcerer", "warlock", "wizard"], src: "PHB",
        t: "Each creature in a 5-ft Emanation around you makes a Constitution save or takes 1d6 Thunder. The sound is heard 100 ft away.", hi: "1d6 more at levels 5, 11 and 17." },
      "arcane-vigor": { n: "Arcane Vigor", lv: 2, sch: "Abjuration", ct: "Bonus Action", r: "Self", c: "V, S", d: "Instantaneous", conc: false, rit: false, cls: ["sorcerer", "wizard"], src: "PHB",
        t: "Spend one or two of your Hit Point Dice: roll them and regain that many HP plus your spellcasting modifier.", hi: "One more Hit Die per slot level above 2." },
      "homunculus-servant": { n: "Homunculus Servant", lv: 2, sch: "Conjuration", ct: "1 hour or Ritual", r: "10 feet", c: "V, S, M (a gem or crystal worth 100+ shins, consumed)", d: "Instantaneous", conc: false, rit: true, cls: [], src: "UA 2024",
        t: "You summon a homunculus (a new one replaces the old). It shares your Initiative and acts right after you, obeys you, and Dodges if you give no command.\n\n**Homunculus Servant** (Tiny Construct): AC 13, HP 5 + 5 per spell level (d4 Hit Dice equal to the spell level), Speed 20 ft, Fly 30 ft. Str 4, Dex 15, Con 12, Int 10, Wis 10, Cha 7. Immune Poison; Exhaustion, Poisoned. Darkvision 60 ft. Telepathy 1 mile with you.\n**Evasion.** **Magic Bond:** adds the spell level to its checks and saves.\n**Force Strike:** melee or ranged (reach 5 ft or 30 ft) with your spell attack bonus, 1d6 + spell level Force.\n**Channel Magic (Reaction):** when you cast a touch spell while it is within 120 ft, it delivers the spell.", hi: "Use the slot level as the spell level in its stat block." },
      "elemental-weapon": { n: "Elemental Weapon", lv: 3, sch: "Transmutation", ct: "Action", r: "Touch", c: "V, S", d: "Concentration, up to 1 hour", conc: true, rit: false, cls: ["druid", "paladin", "ranger"], src: "PHB",
        t: "A nonmagical weapon becomes magic: choose Acid, Cold, Fire, Lightning or Thunder. It gets +1 to attack rolls and deals an extra 1d4 of that type.", hi: "Level 5-6: +2 and 2d4. Level 7+: +3 and 3d4." },
      "summon-construct": { n: "Summon Construct", lv: 4, sch: "Conjuration", ct: "Action", r: "90 feet", c: "V, S, M (a lockbox worth 400+ shins)", d: "Concentration, up to 1 hour", conc: true, rit: false, cls: ["wizard"], src: "PHB",
        t: "You call a Construct Spirit (Clay, Metal or Stone) that obeys you and shares your Initiative. See the Player's Handbook for its stat block (AC 13 + spell level, HP 40 + 15 per level above 4, Slam 1d8 + 4 + spell level).", hi: "It gets stronger with the slot level." },
      "circle-of-power": { n: "Circle of Power", lv: 5, sch: "Abjuration", ct: "Action", r: "Self", c: "V", d: "Concentration, up to 10 minutes", conc: true, rit: false, cls: ["paladin", "wizard"], src: "PHB",
        t: "A 30-ft Emanation: you and allies in it have Advantage on saves against spells and magical effects, and a success on a save for half damage means no damage instead.", hi: "" },
      "aura-of-vitality": { n: "Aura of Vitality", lv: 3, sch: "Abjuration", ct: "Action", r: "Self", c: "V", d: "Concentration, up to 1 minute", conc: true, rit: false, cls: ["cleric", "druid", "paladin"], src: "PHB",
        t: "A 30-ft Emanation. When you cast it and as a Bonus Action on later turns, one creature in it regains 2d6 HP.", hi: "" },
      "conjure-barrage": { n: "Conjure Barrage", lv: 3, sch: "Conjuration", ct: "Action", r: "Self", c: "V, S, M (a Melee or Ranged weapon worth at least 1 CP)", d: "Instantaneous", conc: false, rit: false, cls: ["ranger"], src: "PHB",
        t: "A 60-ft Cone of spectral weapons: Dex save, 5d8 Force (the weapon's type), half on success.", hi: "1d8 more per slot level above 3." },
      "aura-of-purity": { n: "Aura of Purity", lv: 4, sch: "Abjuration", ct: "Action", r: "Self", c: "V", d: "Concentration, up to 10 minutes", conc: true, rit: false, cls: ["cleric", "paladin"], src: "PHB",
        t: "A 30-ft Emanation: allies in it have Resistance to Poison, can't be Poisoned, and have Advantage on saves against several conditions (see the Player's Handbook).", hi: "" },
      "banishing-smite": { n: "Banishing Smite", lv: 5, sch: "Conjuration", ct: "Bonus Action, after you hit with a melee weapon or Unarmed Strike", r: "Self", c: "V", d: "Concentration, up to 1 minute", conc: true, rit: false, cls: ["paladin"], src: "PHB",
        t: "The target takes an extra 5d10 Force. If it has 50 HP or fewer, it is banished to a harmless demiplane until the spell ends.", hi: "" },
      "shining-smite": { n: "Shining Smite", lv: 2, sch: "Transmutation", ct: "Bonus Action, after you hit with a weapon or Unarmed Strike", r: "Self", c: "V", d: "Concentration, up to 1 minute", conc: true, rit: false, cls: ["paladin"], src: "PHB",
        t: "The target takes an extra 2d6 Radiant, sheds light, can't benefit from being Invisible, and attacks against it have Advantage.", hi: "1d6 more per slot level above 2." },
      "bubbling-cauldron": { n: "Tasha's Bubbling Cauldron", lv: 6, sch: "Conjuration", ct: "Action", r: "5 feet", c: "V, S, M (a gilded ladle worth 500+ shins)", d: "10 minutes", conc: false, rit: false, cls: ["warlock", "wizard"], src: "Tasha's",
        t: "A cauldron appears holding copies of a common or uncommon potion you have used; creatures can take potions from it (see Tasha's Cauldron of Everything).", hi: "" }
    }
  };
})();
