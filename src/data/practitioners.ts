// SAS Practitioners directory — seed data.
//
// Phase 1: a static, code-controlled list seeded from the About-page
// therapists. The shape is intentionally richer than the About card
// (slug, country, city, specialties, languages, status, etc.) so this
// module can be lifted into a `practitioners` table in Phase 2 without
// breaking the directory or profile pages.
//
// SAFE TO EDIT: add new practitioners by appending objects to the array.
// Keep `slug` unique and URL-safe.

export type PractitionerStatus =
  | "certified"      // Certified Practitioner
  | "senior"         // Senior Practitioner
  | "instructor"     // Instructor / Trainer
  | "therapist"      // Therapist
  | "graduate";      // Graduate

export interface Practitioner {
  slug: string;
  name: string;
  role: string;
  status: PractitionerStatus[];
  bio: string;
  image: string;
  country: string;
  city: string;
  languages: string[];
  specialties: string[];
  certifications: string[];
  yearsExperience?: number;
  email?: string;
  whatsapp?: string;
  website?: string;
  bookable?: boolean;
  isActive?: boolean;
}

const SQ = "https://images.squarespace-cdn.com/content/v1/65e538a41cdc651ab18c95d3";

export const practitioners: Practitioner[] = [
  {
    slug: "jeffrey",
    name: "Jeffrey",
    role: "Senior Massage Therapist",
    status: ["senior", "certified", "therapist"],
    bio: "With a deep sense of intuition and a wealth of knowledge and skill, Jeffrey creates a safe, supportive space for every client. His unwavering commitment has earned him the trust and loyalty of many returning clients.",
    image: `${SQ}/482c3496-fac3-41c6-8128-dbf346a34884/Jeffrey+certified+massage+therapist+at+Holis+Wellness+Center`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Deep Tissue", "Swedish", "Sports Massage"],
    certifications: ["SAS Certified Practitioner", "Certified Massage Therapist"],
    yearsExperience: 12,
    bookable: true,
    isActive: true,
  },
  {
    slug: "ashley",
    name: "Ashley",
    role: "Massage Therapist & Yoga Instructor",
    status: ["certified", "instructor", "therapist"],
    bio: "Ashley's passion for bodywork rises from her longstanding yoga training and practice. Her capacity to integrate body work techniques and deep understanding of body mechanics make her sessions exceptional.",
    image: `${SQ}/262fc549-f6a6-456c-8eb2-3d3bcbd3a47a/Ashley+certified+massage+therapist+at+Holis+Wellness+Center`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Yoga", "Deep Tissue", "Body Mechanics"],
    certifications: ["SAS Certified Practitioner", "Yoga Instructor"],
    yearsExperience: 8,
    bookable: true,
    isActive: true,
  },
  {
    slug: "jocelyne",
    name: "Jocelyne",
    role: "Massage Therapist",
    status: ["certified", "therapist"],
    bio: "A dedicated therapist bringing care and expertise to every session. Jocelyne's grounded presence helps clients fully relax and reconnect with the body.",
    image: `${SQ}/7ac371a1-0959-4528-b827-613a9515ab6b/WhatsApp+Image+2026-02-17+at+14.37.56.jpeg`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish"],
    specialties: ["Swedish", "Relaxation"],
    certifications: ["SAS Certified Practitioner"],
    bookable: true,
    isActive: true,
  },
  {
    slug: "dilana",
    name: "Dilana",
    role: "Senior Massage Therapist",
    status: ["senior", "certified", "therapist"],
    bio: "Over 20 years at Holis — a record in Manuel Antonio. Her practice combines deep spirituality, great energy, and expertise in Deep Tissue, Swedish, Thai Massage, and Aromatouch Technique.",
    image: `${SQ}/6462e701-32c4-48ba-a6c8-9ff4f3529c29/Dilana+certified+massage+therapist+at+Holis+Wellness+Center`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Deep Tissue", "Swedish", "Thai Massage", "Aromatouch"],
    certifications: ["SAS Senior Practitioner", "Aromatouch Certified"],
    yearsExperience: 20,
    bookable: true,
    isActive: true,
  },
  {
    slug: "jenny",
    name: "Jenny",
    role: "Massage Therapist",
    status: ["certified", "therapist"],
    bio: "Bringing healing touch and dedicated care to every client experience.",
    image: `${SQ}/d25ab0e1-a2b7-4426-8f64-c6cd3e0b04aa/WhatsApp+Image+2026-02-17+at+14.37.55.jpeg`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish"],
    specialties: ["Swedish", "Relaxation"],
    certifications: ["SAS Certified Practitioner"],
    bookable: true,
    isActive: true,
  },
  {
    slug: "thiara",
    name: "Thiara",
    role: "Massage Therapist",
    status: ["certified", "therapist"],
    bio: "A skilled therapist dedicated to creating restorative experiences.",
    image: `${SQ}/06ec6388-2ec6-4fcd-878c-18916e3f93ac/Thiara.jpg`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish"],
    specialties: ["Swedish", "Deep Tissue"],
    certifications: ["SAS Certified Practitioner"],
    bookable: true,
    isActive: true,
  },
  {
    slug: "priscilla",
    name: "Priscilla",
    role: "Massage Therapist & Yoga Teacher",
    status: ["certified", "instructor", "therapist"],
    bio: "Since age 19, Priscilla has built a rich practice spanning Thai massage, Reiki, and a 200-hour yoga teacher training — bringing deep knowledge of body biomechanics to every session.",
    image: `${SQ}/0e872735-f4a0-4462-8c85-707615b96abb/Priscilla+certified+massage+therapist+at+Holis+Wellness+Center`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Thai Massage", "Reiki", "Yoga", "Biomechanics"],
    certifications: ["SAS Certified Practitioner", "200-hr Yoga Teacher"],
    yearsExperience: 10,
    bookable: true,
    isActive: true,
  },
  {
    slug: "susana",
    name: "Susana",
    role: "Massage Therapist",
    status: ["senior", "certified", "therapist"],
    bio: "Since 2009, Susana has enriched her practice with Reiki, Thai massage, CranioSacral therapy, crystal healing, and traditional Chinese medicine including cupping and reflexology.",
    image: `${SQ}/12c3c539-3861-4731-8c6a-97c6b0db8a7b/Susana+certified+massage+therapist+at+Holis+Wellness+Center`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Reiki", "Thai Massage", "CranioSacral", "Reflexology", "Cupping"],
    certifications: ["SAS Senior Practitioner", "CranioSacral Therapist"],
    yearsExperience: 16,
    bookable: true,
    isActive: true,
  },
  {
    slug: "betsabe",
    name: "Betsabé",
    role: "Massage Therapist & Yoga Instructor",
    status: ["certified", "instructor", "therapist"],
    bio: "Betza discovered yoga in 2013 and fell in love with the practice. Now certified in Vinyasa Flow and children's yoga methodology, she brings both therapeutic touch and mindful movement to her work.",
    image: `${SQ}/dc47f406-43ed-4bbb-acf7-fce9347e9ae3/WhatsApp+Image+2026-02-18+at+08.28.49.jpeg`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Vinyasa Yoga", "Children's Yoga", "Bodywork"],
    certifications: ["SAS Certified Practitioner", "Vinyasa Yoga Teacher"],
    yearsExperience: 9,
    bookable: true,
    isActive: true,
  },
  {
    slug: "christofer",
    name: "Christofer",
    role: "Massage Therapist",
    status: ["certified", "therapist"],
    bio: "Passionate about bodywork from the start, Christofer trained in Thai massage and expanded into sports massage, deep tissue, and reflexology. One of the most requested therapists, especially for Thai massage.",
    image: `${SQ}/f066b53e-0323-4f37-a30e-c8705ebb2b27/Christofer+certified+massage+therapist+at+Holis+Wellness+Center`,
    country: "Costa Rica",
    city: "Manuel Antonio",
    languages: ["Spanish", "English"],
    specialties: ["Thai Massage", "Sports Massage", "Deep Tissue", "Reflexology"],
    certifications: ["SAS Certified Practitioner"],
    yearsExperience: 7,
    bookable: true,
    isActive: true,
  },
];

export const STATUS_LABELS: Record<PractitionerStatus, string> = {
  certified: "Certified Practitioner",
  senior: "Senior Practitioner",
  instructor: "Instructor",
  therapist: "Therapist",
  graduate: "Graduate",
};

export function getPractitionerBySlug(slug: string): Practitioner | undefined {
  return practitioners.find((p) => p.slug === slug && p.isActive !== false);
}

export function getActivePractitioners(): Practitioner[] {
  return practitioners.filter((p) => p.isActive !== false);
}
