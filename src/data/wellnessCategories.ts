/**
 * ═══════════════════════════════════════════════════════════════
 *  WELLNESS CATEGORIES — SOURCE OF TRUTH
 *  All treatment & class names MUST match the database exactly.
 *  DO NOT rename, shorten, or create variations.
 * ═══════════════════════════════════════════════════════════════
 */

export interface WellnessTreatment {
  name: string;
  description: string;
  tag: "Relax" | "Energy" | "Recovery" | "Transform";
}

export interface WellnessCategory {
  id: string;
  title: string;
  tagline: string;
  intent: string;
  image: string;
  treatments: WellnessTreatment[];
}

export const wellnessCategories: WellnessCategory[] = [
  {
    id: "unwind_relax",
    title: "Unwind & Relax",
    tagline: "Arrive, slow down, and let go",
    intent: "I want to switch off and feel taken care of",
    image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80",
    treatments: [
      // Massage Therapy (DB)
      { name: "Somato Awareness System Massage (90min)", description: "Deep nervous system reset through gentle, intuitive bodywork", tag: "Relax" },
      { name: "Holisynergie (60min)", description: "Signature blend of techniques to dissolve tension and restore flow", tag: "Relax" },
      { name: "Holisynergie (90min)", description: "Extended signature session for complete relaxation and renewal", tag: "Relax" },
      { name: "Pure Bliss Swedish (60min)", description: "Full-body relaxation to release stress and calm the nervous system", tag: "Relax" },
      { name: "Pure Bliss Swedish (90min)", description: "Extended Swedish massage for deeper relaxation and tension release", tag: "Relax" },
      { name: "Couples Massage (60min)", description: "Share a relaxing massage experience side by side", tag: "Relax" },
      { name: "Couples Massage (90min)", description: "Extended couples session for deeper connection and relaxation", tag: "Relax" },
      { name: "Reflexology (45min)", description: "Targeted pressure-point therapy for feet and hands", tag: "Relax" },
      // Organic Facials (DB)
      { name: "Essenthya Deluxe\nFacial 75min", description: "Nourishing organic facial for deep hydration and radiance", tag: "Relax" },
      { name: "Essenthya Mini-Facial", description: "Quick refresh for a healthy, dewy glow", tag: "Relax" },
      { name: "Essenthya Hydration Facial", description: "Intense moisture boost for dry or sun-exposed skin", tag: "Relax" },
      // Body Treatments (DB)
      { name: "Chocomokacoco Body Wrap", description: "Rich cocoa wrap to soften, hydrate, and deeply nourish the skin", tag: "Relax" },
      { name: "Muddy Buddy", description: "Detoxifying mineral mud to purify and rejuvenate the body", tag: "Relax" },
      { name: "Aloe Mint Smoothie", description: "Cooling aloe and mint wrap to soothe and revitalize", tag: "Relax" },
      // Classes (DB)
      { name: "Slow Flow Yoga", description: "Gentle movement and breathwork to close the day peacefully", tag: "Relax" },
      { name: "Yin Yoga", description: "Deep stretching and stillness for profound relaxation", tag: "Relax" },
      { name: "Sound Bath", description: "Immersive sound healing session for deep inner stillness", tag: "Relax" },
    ],
  },
  {
    id: "activate_uplift",
    title: "Activate & Uplift",
    tagline: "Feel alive, radiant, and energized",
    intent: "I want energy, glow, and vitality",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
    treatments: [
      // Classes (DB)
      { name: "Vinyasa Flow", description: "Dynamic yoga practice linking breath and movement", tag: "Energy" },
      { name: "Vinyasa Power Flow", description: "Energizing power yoga for strength and vitality", tag: "Energy" },
      { name: "Vinyasa Yoga", description: "Flowing sequences to build heat, focus, and flexibility", tag: "Energy" },
      { name: "Hatha Yoga", description: "Classical yoga postures for balance, strength, and awareness", tag: "Energy" },
      { name: "Yoga Fit Fusion", description: "Yoga meets fitness for a full-body energizing workout", tag: "Energy" },
      { name: "Yoga Core", description: "Core-focused yoga to strengthen and stabilize", tag: "Energy" },
      { name: "Energy Flow", description: "Uplifting movement class to boost energy and mood", tag: "Energy" },
      { name: "Gyrokinesis® with Evelina", description: "Rhythmic, flowing sequences for flexibility and balance", tag: "Energy" },
      { name: "Cardio Vascular Breathwork", description: "Activating breath techniques for clarity and energy", tag: "Energy" },
      // Organic Facials (DB)
      { name: "Facial Glow", description: "Brightening facial to reveal your natural radiance", tag: "Energy" },
      // Massage Therapy (DB)
      { name: "Holisynergie (45min)", description: "Invigorating shorter session to awaken and restore vitality", tag: "Energy" },
    ],
  },
  {
    id: "recover_restore",
    title: "Recover & Restore",
    tagline: "Feel good again in your body",
    intent: "My body needs help",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    treatments: [
      // Massage Therapy (DB)
      { name: "Somato Awareness System (2hr)", description: "Extended session for deep structural release and recovery", tag: "Recovery" },
      { name: "Traditional Thai Massage", description: "Assisted stretching and acupressure for mobility and relief", tag: "Recovery" },
      { name: "Traditional Cupping", description: "Ancient technique to increase circulation and relieve muscle stiffness", tag: "Recovery" },
      { name: "Reflexology (60min)", description: "Extended pressure-point therapy for systemic balance", tag: "Recovery" },
      // Holistic Therapy (DB)
      { name: "CranioSacral Therapy", description: "Gentle cranial therapy to relieve pain and restore nervous system balance", tag: "Recovery" },
      { name: "Somato Emotional Release", description: "Release stored emotional tension through guided bodywork", tag: "Recovery" },
      { name: "Hydrogen Therapy", description: "Advanced hydrogen therapy for cellular recovery and inflammation", tag: "Recovery" },
      // Body Treatments (DB)
      { name: "Spicy Ginger Rub", description: "Warming ginger treatment to stimulate circulation and ease soreness", tag: "Recovery" },
      { name: "Slimming Kelp Cocoon", description: "Mineral-rich sea kelp wrap for detox and toning", tag: "Recovery" },
      { name: "Toning & Slimming Treatment", description: "Targeted body treatment for toning and contouring", tag: "Recovery" },
      { name: "Mint Blast for Legs & Feet", description: "Cooling mint therapy for tired, heavy legs and feet", tag: "Recovery" },
    ],
  },
  {
    id: "learn_transform",
    title: "Learn & Transform",
    tagline: "Take something meaningful home",
    intent: "I want something meaningful to take home",
    image: "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=1200&q=80",
    treatments: [
      // Holistic Therapy (DB)
      { name: "Holis Jump Start System", description: "Intensive program to kickstart your wellness journey", tag: "Transform" },
      // Organic Facials (DB)
      { name: "Japanese Cosmolifting Facial (60min)", description: "Traditional Japanese lifting technique for facial rejuvenation", tag: "Transform" },
      { name: "Japanese Cosmolifting Facial (120min)", description: "Extended Japanese facial for deep transformation and glow", tag: "Transform" },
      // Classes (DB)
      { name: "Self Care & Wellbeing with Evelina", description: "Learn self-care techniques you can practice daily", tag: "Transform" },
      // Workshop (DB)
      { name: "Wellness Together: A Massage Class for Two", description: "Learn massage techniques with your partner in a guided workshop", tag: "Transform" },
    ],
  },
];

export const feelingFilters = [
  { label: "Relaxed", categoryId: "unwind_relax" },
  { label: "Energized", categoryId: "activate_uplift" },
  { label: "Pain-free", categoryId: "recover_restore" },
  { label: "Transformed", categoryId: "learn_transform" },
] as const;
