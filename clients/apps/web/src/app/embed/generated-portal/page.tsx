'use client'

import {
  GeneratedPortalPage,
  type GeneratedGroup,
} from '@/components/Courses/editor/GeneratedPortalPage'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

// Bare preview of the generated course page with the designs' sample data.
// Query params drive the combination so every axis can be eyeballed:
//   ?hero=marquee|cover  &card=spotlight|catalog
//   &trial=preview|sample  &structure=modules|episodic  &dark=1
const RAW_MODULES: { title: string; lessons: [string, string][] }[] = [
  {
    title: 'Foundations',
    lessons: [
      ['Grip & Setup', 'Where every swing begins. The neutral grip, pressure points, and a setup you can repeat under pressure.'],
      ['Stance & Alignment', 'Aim is a skill. Building a stance that points the body and the clubface at the same target.'],
      ['Ball Position', 'One variable, every club. How ball position changes strike, flight, and why most players get it wrong.'],
      ['Posture & Balance', 'The athletic base. Spine angle, knee flex, and weight that stays centered through the swing.'],
      ['Pre-Shot Routine', 'The same 20 seconds before every shot. Building a routine that quiets the mind.'],
      ['Equipment Essentials', 'What actually matters in the bag. Lofts, lies, and a setup that fits your swing.'],
    ],
  },
  {
    title: 'The Swing',
    lessons: [
      ['The Takeaway', 'The first 18 inches decide the rest. Starting the club back on plane, every time.'],
      ['The Backswing', 'Width, turn, and the top position. Loading power without losing the clubface.'],
      ['Downswing & Impact', 'Sequencing from the ground up. Why impact is a position you arrive at, not one you force.'],
      ['Tempo & Rhythm', 'Smooth is fast. Training a swing that holds together on the first tee and the last hole.'],
      ['Driver Off the Tee', 'Width and launch. Hitting up on the ball and finding more fairways with more speed.'],
      ['Iron Striking', 'Ball first, turf second. Compressing irons and controlling your landing distances.'],
    ],
  },
  {
    title: 'Scoring',
    lessons: [
      ['Chipping & Pitching', 'One technique, many distances. Landing spots, trajectory, and touch around the green.'],
      ['Bunker Play', 'The shot that scares everyone, simplified. Using the bounce and committing through the sand.'],
      ['Reading the Green', 'Slope, grain, and speed. Seeing the line before you ever stand over the ball.'],
      ['Putting Under Pressure', 'A routine that survives nerves. Short putts, long lags, and the discipline of pace.'],
      ['Wedge Distance Control', 'The clock system. Three swings per wedge for a number you can trust inside 100 yards.'],
      ['Course Strategy', 'Playing the percentages. Picking targets that fit your shot, not the one you wish you had.'],
    ],
  },
]

const EPISODES: [string, string][] = [
  ['The Wager', 'Pebble Beach, dawn. Jack bets a stranger he can fix any swing in one round — and explains why he always wins.'],
  ['The Grip Is a Lie', 'Everything you were taught about holding a club, unlearned. Shot in the workshop where Jack rebuilds grips.'],
  ['Eighteen Inches', 'The takeaway, filmed at 1,000 frames a second. The first move that decides every shot.'],
  ['The Lake at Sawgrass', 'Why great players aim at trouble. A walk through the most feared par 3 in golf.'],
  ['Smooth Is Fast', 'Tempo, filmed with orchestra conductors and tour pros side by side.'],
  ['The Short Game Heist', 'Inside 100 yards, where rounds are stolen. Wedges, spin, and nerve.'],
]

function Preview() {
  const params = useSearchParams()
  const heroVariant = params.get('hero') === 'marquee' ? 'marquee' : 'cover'
  const cardVariant = params.get('card') === 'catalog' ? 'catalog' : 'spotlight'
  const trialMode =
    params.get('trial') === 'preview' ? 'free_preview' : 'lesson_sample'
  const structure =
    params.get('structure') === 'episodic' ? 'episodic' : 'modules'
  const [dark, setDark] = useState(params.get('dark') === '1')
  // `?editable=1` exercises the creator affordances (Add cover / Reposition /
  // Add trailer / per-card Add image / sample CTA) with no-op handlers.
  const editable = params.get('editable') === '1'
  const withCover = params.get('cover') === '1'

  const freeLessons = 3
  let flat = 0
  const toLesson = ([title, description]: [string, string]) => {
    const flatIdx = flat++
    const locked = trialMode === 'lesson_sample' || flatIdx >= freeLessons
    return { title, description, flatIdx, free: !locked, locked }
  }
  const groups: GeneratedGroup[] =
    structure === 'episodic'
      ? [{ title: null, lessons: EPISODES.map(toLesson) }]
      : RAW_MODULES.map((m) => ({
          title: m.title,
          lessons: m.lessons.map(toLesson),
        }))

  return (
    <GeneratedPortalPage
      brand="Spaire Originals"
      title="The Golfer’s Blueprint"
      titleLines={['The Golfer’s', 'Blueprint']}
      eyebrow="Documentary Series · Golf"
      badge="New Series"
      desc="A two-time major champion takes you inside the scoring game — the swing, the short game, and the mind that wins the shots that matter. Shot like a film, taught like a private lesson."
      byline="Two-time major champion and former world No. 1."
      instructorName="Jack Reeves"
      heroVariant={heroVariant}
      cardVariant={cardVariant}
      structure={structure}
      trialMode={trialMode}
      paywallEnabled
      freeLessons={freeLessons}
      playLabel={
        trialMode === 'lesson_sample' ? 'Play Sample' : 'Play Episode 1 Free'
      }
      buyLabel="Subscribe — $89"
      freeLine={
        trialMode === 'lesson_sample'
          ? 'Sample clip free · cancel anytime'
          : 'First 3 episodes free · cancel anytime'
      }
      groups={groups}
      lessonCount={flat}
      unit={structure === 'episodic' ? 'episode' : 'lesson'}
      dark={dark}
      onToggleDark={() => setDark((d) => !d)}
      coverUrl={withCover ? '/assets/onboarding/cover-hero.jpg' : undefined}
      editable={editable}
      onAddCover={editable ? () => {} : undefined}
      onAddTrailer={editable ? () => {} : undefined}
      onCoverPosition={editable ? () => {} : undefined}
      onAddLessonImage={editable ? () => {} : undefined}
      onConfigureSample={editable ? () => {} : undefined}
    />
  )
}

export default function GeneratedPortalPreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  )
}
