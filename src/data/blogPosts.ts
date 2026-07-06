import thingsToDoImage from "@/assets/blog/things-to-do-manuel-antonio.jpeg";
import mindfulnessCoffeeImage from "@/assets/blog/mindfulness-coffee.jpg";
import mindfulnessBeingImage from "@/assets/blog/mindfulness-being.png";
import yogaModernImage from "@/assets/blog/yoga-modern-world.png";
import breathworkImage from "@/assets/blog/breathwork.jpg";
import affordableRetreatsImage from "@/assets/blog/affordable-retreats.jpg";
import florianModeImage from "@/assets/blog/florian-mode.jpg";
import hydrogenTherapyImage from "@/assets/blog/hydrogen-therapy.jpg";

export type BlogPost = {
  title: string;
  slug: string;
  author: string;
  date: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  sourceUrl: string;
};

export const blogPosts: BlogPost[] = [
  {
    title: "Relaxing Things to Do in Manuel Antonio Costa Rica",
    slug: "things-to-do-manuel-antonio-costa-rica",
    author: "Holis Wellness Center",
    date: "4/21/26",
    excerpt:
      "Looking for the best things to do in Manuel Antonio, Costa Rica? Beyond wildlife, beaches, and adventure tours, this destination is perfect for relaxation and wellness. From yoga and massage to somatic awareness experiences at Holis Spa & Wellness Center, visitors can unwind, recharge, and reconnect with their body in a truly unique tropical setting.",
    image: thingsToDoImage,
    imageAlt: "Relaxing things to do in Manuel Antonio Costa Rica",
    sourceUrl: "https://www.spaholis.com/blog/things-to-do-manuel-antonio-costa-rica",
  },
  {
    title: "Mindfulness and Coffee: How to Make Our Morning Ritual Sacred",
    slug: "mindfulness-and-coffee-how-to-make-our-morning-ritual-sacred",
    author: "Holis Wellness Center",
    date: "11/17/25",
    excerpt:
      "Most of us go straight to the coffee pot the instant we wake up. It is comforting, familiar, and almost automatic. But that first cup can be much more than a jolt of caffeine. It can be a conscious ritual that follows the body’s natural rhythms rather than working against them. When we wait a little before drinking coffee, we give our bodies time to wake up on their own terms. What follows is not just sharper focus and more stable energy, but a deeper sense of control and calm that lasts through the day.",
    image: mindfulnessCoffeeImage,
    imageAlt: "Mindfulness and coffee morning ritual",
    sourceUrl: "https://www.spaholis.com/blog/mindfulness-and-coffee-how-to-make-our-morning-ritual-sacred",
  },
  {
    title: "Mindfulness: Returning to the Simplicity of Being",
    slug: "mindfulness-returning-to-the-simplicity-of-being",
    author: "Holis Wellness Center",
    date: "11/4/25",
    excerpt:
      "In a world filled with endless messages, constant notifications, and the background noise of technology, mindfulness offers a powerful remedy. For many, the idea of being truly present can seem old-fashioned or even impossible when every part of life competes for attention. Yet this is exactly why mindfulness matters more than ever. It helps us build real wellbeing, strengthen the nervous system, and find calm in the middle of everyday chaos.",
    image: mindfulnessBeingImage,
    imageAlt: "Mindfulness returning to the simplicity of being",
    sourceUrl: "https://www.spaholis.com/blog/mindfulness-returning-to-the-simplicity-of-being",
  },
  {
    title: "When Tradition Meets the Modern World: The Evolving Power of Yoga",
    slug: "when-tradition-meets-the-modern-world-the-evolving-power-of-yoga",
    author: "Holis Wellness Center",
    date: "10/21/25",
    excerpt:
      "Yoga has always been more than exercise. It’s a philosophy, a lifestyle, and a pathway toward self-awareness and balance. Yet in our world of fast schedules, screens, and endless to-do lists, yoga has had to evolve. This change is not a departure from its roots. It is a continuation of its purpose: to help us reconnect body, mind, and something deeper within ourselves. When the traditional practice meets modern life, yoga becomes something powerful, accessible, and alive.",
    image: yogaModernImage,
    imageAlt: "When tradition meets the modern world yoga",
    sourceUrl: "https://www.spaholis.com/blog/when-tradition-meets-the-modern-world-the-evolving-power-of-yoga",
  },
  {
    title: "Breathwork: The Science and Practice of Using the Breath to Transform Body and Mind",
    slug: "breathwork-the-science-and-practice-of-using-the-breath-to-transform-body-and-mind",
    author: "Holis Wellness Center",
    date: "9/22/25",
    excerpt:
      "Breathing is something we do more than twenty thousand times a day, yet most of us rarely pay attention to it. The breath is far more than a simple exchange of oxygen and carbon dioxide. It is one of the most direct ways to influence our nervous system, our mental state, and even our long-term health. This is why breathwork has become one of the most exciting and accessible tools for resilience, focus, and wellbeing.",
    image: breathworkImage,
    imageAlt: "Breathwork science and practice",
    sourceUrl: "https://www.spaholis.com/blog/breathwork-the-science-and-practice-of-using-the-breath-to-transform-body-and-mind",
  },
  {
    title: "Affordable Yoga & Holistic Wellbeing Retreats in Costa Rica",
    slug: "affordable-yoga-and-holistic-wellbeing-retreats-in-costa-rica",
    author: "Guest User",
    date: "9/4/25",
    excerpt:
      "At Holis Wellness Center in Manuel Antonio, we believe that true wellbeing should not be reserved only for a few. It should be open, welcoming, and affordable to everyone. That is why we offer retreats that balance cost with quality, blending comfort, transformation, and the deep healing power of nature.",
    image: affordableRetreatsImage,
    imageAlt: "Affordable yoga and holistic wellbeing retreats in Costa Rica",
    sourceUrl: "https://www.spaholis.com/blog/affordable-yoga-and-holistic-wellbeing-retreats-in-costa-rica",
  },
  {
    title: "Meet Florian Mode: Your Expert Osteopath at Holis Wellness Center",
    slug: "meet-florian-mode-your-expert-osteopath-at-holis-wellness-center",
    author: "Holis Wellness Center",
    date: "7/3/25",
    excerpt:
      "Discover authentic European osteopathy with Florian Mode at Holis Wellness Center in Manuel Antonio. With over 5,400 hours of specialized training from France, Florian uses gentle manual techniques to treat back pain, migraines, sports injuries, and more. His holistic approach addresses root causes, treating your body like a finely tuned instrument. Experience transformative natural healing for all ages.",
    image: florianModeImage,
    imageAlt: "Meet Florian Mode expert osteopath at Holis Wellness Center",
    sourceUrl: "https://www.spaholis.com/blog/meet-florian-mode-your-expert-osteopath-at-holis-wellness-center",
  },
  {
    title: "Unveiling the Miraculous Benefits of Molecular Hydrogen Therapy",
    slug: "unveiling-the-miraculous-benefits-of-molecular-hydrogen-therapy",
    author: "Holis Wellness Center",
    date: "5/2/24",
    excerpt:
      "Discover the transformative benefits of Molecular Hydrogen Therapy at Holis Wellness Center in Manuel Antonio, Costa Rica. This innovative treatment harnesses the power of hydrogen gas inhalation to reduce inflammation, boost energy levels, and enhance overall well-being. Our sessions combine the healing properties of molecular hydrogen with reflexology and aromatherapy, offering a holistic approach to health.",
    image: hydrogenTherapyImage,
    imageAlt: "Benefits of molecular hydrogen therapy",
    sourceUrl: "https://www.spaholis.com/blog/unveiling-the-miraculous-benefits-of-molecular-hydrogen-therapy",
  },
];