// Static fallback data — used when DB is not available
export interface Service {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: number;
  category: string;
  image: string;
}

export const testimonials = [
  {
    id: "1",
    name: "Chrissy S.",
    text: "I had a 60 min massage and facial. Both were amazing! Great price for what you get! Super friendly and accommodating — highly recommend.",
    rating: 5,
    context: "Spa Guest",
    date: "Mar 2026",
  },
  {
    id: "2",
    name: "Petra H.",
    text: "Holis Spa is a true healing gem of Manuel Antonio. I visit whenever I'm in town, and it's always the most deeply restorative part of my trip.",
    rating: 5,
    context: "Solo Traveler",
    date: "Mar 2026",
  },
  {
    id: "3",
    name: "Bart R.",
    text: "Warm welcome by the front desk. I had a 90-minute deep tissue with Jenny — one of the best massages I have ever had. Highly recommend.",
    rating: 5,
    context: "Friends Trip",
    date: "Feb 2026",
  },
  {
    id: "4",
    name: "Kathy W.",
    text: "I booked a facial as a special treat. It was top notch from beginning to end. The place is lovely, as is the staff. My skin felt so good. Highly recommend!",
    rating: 5,
    context: "Couple",
    date: "Feb 2026",
  },
  {
    id: "5",
    name: "Gena",
    text: "We did the couples massage, which included a facial and body mask. Husband said Susana gave him the best massage he has ever had. Easy to book and prompt follow-up.",
    rating: 5,
    context: "Couples",
    date: "Jan 2026",
  },
  {
    id: "6",
    name: "Kristy R.",
    text: "Booked a 4-day yoga, hiking, and surfing retreat — what an incredible experience with the most beautiful, kind people. Could not have asked for a better experience!",
    rating: 5,
    context: "Friends Trip",
    date: "Jan 2026",
  },
  {
    id: "7",
    name: "Yetunde A.",
    text: "My experience was transformative. Evelina personalized my treatment plan and the staff truly became like family. I am eternally thankful.",
    rating: 5,
    context: "Solo Traveler",
    date: "Jun 2025",
  },
  {
    id: "8",
    name: "Jeff S.",
    text: "After a fantastic yoga class, my wife and I booked a couples massage. We both agreed it was the best massage ever. The little things make this place special.",
    rating: 5,
    context: "Couples",
    date: "Jan 2026",
  },
  {
    id: "9",
    name: "Deneen C.",
    text: "I have been going here for years on our visits to Costa Rica. They have everything you could want — yoga, massage, facials. Worth the trip for this experience alone!",
    rating: 5,
    context: "Solo Traveler",
    date: "Jan 2026",
  },
];