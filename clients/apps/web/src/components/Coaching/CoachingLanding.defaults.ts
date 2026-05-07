import type { CoachingLandingData } from './CoachingLanding.types'

export const defaultCoachingLandingData: CoachingLandingData = {
  nav: {
    brand: 'Hermes',
  },
  hero: {
    titleParts: [
      { text: 'Personalized' },
      { text: 'fitness', italic: true },
      { text: 'programs for' },
      { text: 'real results', italic: true },
      { text: '.' },
    ],
    subtitle:
      "Don't wait for the perfect moment, build the body you've always dreamed of.",
    ctaPrimary: 'See Our Programs',
    ctaSecondary: 'Learn More',
    heroMediaUrl:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=2400&q=85',
    heroMediaType: 'image',
    clientsPillText: '+11322 clients',
    clientsAvatars: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80',
    ],
  },
  coreEvolution: {
    heading: 'Core Evolution',
    description:
      'Transform your body and mind through sustainable habits, structured workouts, and mindful nutrition. Core Evolution focuses on long‑term progress — not quick fixes — to help you feel stronger, lighter, and more confident every day.',
    resultsHeading: 'Expected Results',
    stats: [
      { label: 'Sleep Quality', value: '+35%', barPercent: 65 },
      { label: 'Flexibility', value: '+30%', barPercent: 60 },
      { label: 'Nutrition habits', value: '+80%', barPercent: 80 },
      { label: 'Body Fat', value: '-10%', barPercent: 40 },
      { label: 'Muscle Tone', value: '+35%', barPercent: 65 },
      { label: 'Energy Levels', value: '+45%', barPercent: 75 },
    ],
    cta: 'Join Today',
    mediaUrl:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1600&q=85',
    mediaType: 'image',
    caption: 'Your foundation for lasting change.',
  },
  courses: {
    heading: 'Your Journey, Step by Step',
    lede: "Each program is divided into clear, progressive chapters — guiding you from fundamentals to mastery. Every week, you'll unlock new lessons, workouts, and insights designed to help you evolve at your own pace.",
    formats: ['D', 'Q', 'V', 'C'],
    modules: [
      {
        title: 'Getting Started Right',
        lessons: [
          {
            code: '01.1 /',
            text: 'Week 1: Assess your fitness & define clear goals',
            kind: 'D',
          },
          {
            code: '01.2 /',
            text: 'Week 2: Build a workout routine that fits your lifestyle',
            kind: 'Q',
          },
          {
            code: '01.3 /',
            text: 'Week 3: Test your nutrition knowledge with a quick quiz',
            kind: 'V',
          },
        ],
      },
      {
        title: 'Building Strength & Endurance',
        lessons: [
          {
            code: '02.1 /',
            text: 'Learn the fundamentals of strength training',
            kind: 'V',
          },
          {
            code: '02.2 /',
            text: 'Week 5: Strengthen your core and improve stability',
            kind: 'V',
          },
          {
            code: '02.3 /',
            text: 'Week 6: Join a 3‑day endurance challenge with real‑time coaching',
            kind: 'C',
          },
        ],
      },
      {
        title: 'Mastering Nutrition & Recovery',
        lessons: [
          {
            code: '03.1 /',
            text: 'Week 7: Plan your meals to support your training goals',
            kind: 'D',
          },
          {
            code: '03.2 /',
            text: 'Week 8: Optimize recovery and prevent injuries',
            kind: 'V',
          },
          {
            code: '03.3 /',
            text: 'Week 9: Adjust your diet for fat loss or muscle gain',
            kind: 'Q',
          },
        ],
      },
      {
        title: 'Mindset & Consistency',
        lessons: [
          {
            code: '04.1 /',
            text: 'Week 10: Overcome mental barriers and plateaus',
            kind: 'V',
          },
          {
            code: '04.2 /',
            text: 'Week 11: Build daily habits that compound',
            kind: 'D',
          },
          {
            code: '04.3 /',
            text: 'Week 12: Graduation and what to do next',
            kind: 'C',
          },
        ],
      },
    ],
  },
  faq: {
    heading: 'Frequently Asked Questions',
    lede: 'Because clarity is key to lasting results. Here are the answers to the most common questions about our programs and philosophy.',
    cta: 'Get In Touch',
    items: [
      {
        q: 'How are your programs different from other fitness plans?',
        a: "Our programs are built around long-term sustainability rather than quick wins. You'll get coaching, accountability, and a community of people on the same journey.",
      },
      {
        q: 'Do I need gym access to follow the programs?',
        a: 'No — most workouts are designed to work at home with minimal equipment. Gym variations are provided for those who prefer.',
      },
      {
        q: 'Are the programs suitable for beginners?',
        a: 'Yes. Every program starts with a baseline assessment and progresses at your pace.',
      },
      {
        q: 'How long before I see results?',
        a: 'Most members see and feel changes within 3-4 weeks of consistent practice.',
      },
      {
        q: 'Is nutrition included in the subscription?',
        a: 'Yes — meal plans, recipes, and nutrition coaching are part of every program.',
      },
      {
        q: 'What kind of support do I get after joining?',
        a: "You'll get direct WhatsApp coaching, a private community, and weekly live Q&As.",
      },
    ],
  },
  atlas: {
    eyebrow: 'Redefine your limits.',
    title: 'Atlas Program',
    meta: [
      { label: 'Duration', value: '4 Months' },
      { label: 'Nutrition', value: '1 Meal Plan' },
      { label: 'Follow-up', value: 'WhatsApp Follow-up' },
    ],
    orderCta: 'Order - $99',
    sections: [
      {
        label: 'Ideal for',
        body: 'Ideal for those aiming to lose weight, build muscle, and maintain lasting results through structured, sustainable training.',
      },
      {
        label: 'Money-back guarantee',
        body: "If you're not fully satisfied with your results, you can request a full refund within 30 days of your purchase — no questions asked.",
      },
      {
        label: 'Delivery & access',
        body: "Once you join the program, you'll receive instant access to your personal training dashboard. From there, you can stream video lessons, download PDF guides, take interactive quizzes, and even chat with your coach directly via WhatsApp. Everything is digital — no waiting, no shipping — so you can start your transformation the moment you sign up.",
      },
    ],
    testimonial: {
      quote:
        '"Atlas taught me consistency and discipline. I lost 8 kg in three months, gained lean muscle, and, most importantly, learned how to sustain my progress long term."',
      author: 'Diego. S',
      authorSub: 'Atlas Program',
    },
    slides: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1600&q=85',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1600&q=85',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1600&q=85',
    ],
  },
}
