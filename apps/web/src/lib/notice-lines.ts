/*
 * Everything the site can say when it "notices" you. Each group is picked at random; one-off lines
 * (id ends in "!") are only ever said once per phone. Roman Urdu sprinkled in on purpose.
 * {n}, {mins}, {secs}, {days}, {pct}, {snippet} are filled in at runtime.
 */
export const LINES = {
  firstVisit: [
    'Hi. Heads up: this site notices things. You’ll see.',
    'New face. Welcome. Fair warning, I pay attention.',
  ],
  secondVisit: [
    'Oh, you came back. I was hoping you would.',
    'Visit number two. We’re getting somewhere.',
  ],
  thirdVisit: [
    'Third visit. You’re basically on the team now.',
    'Three times? Okay, you like us. Noted.',
  ],
  manyVisits: [
    'Visit number {n}. At this point you should be helping organise.',
    '{n} visits. I’m starting to recognise your scroll.',
    'You again! Visit {n}. Chai’s on us at this point.',
  ],
  sameDayAgain: ['Back again today. I see you.', 'Couldn’t stay away, huh? Same day, again.'],
  longGap: [
    'It’s been {days} days. I thought you forgot about us.',
    '{days} days later. Welcome back, stranger.',
  ],

  lateNight: [
    '{time} and you’re on an event website. Respect.',
    'It’s {time}. Shouldn’t you be asleep? Or studying?',
    'Late night scrolling. Your assignment is somewhere crying.',
    'Raat ke {hour} baje bhi Chai Connect? Dedication.',
  ],
  earlyMorning: [
    'Up before the sun. Fajr crowd, we salute you.',
    'Early bird. The chai isn’t even ready yet.',
  ],
  lunch: ['Lunch break browsing? Valid.', 'Scrolling with food in one hand. We know.'],
  jummah: ['Jummah Mubarak. Don’t be late for the khutbah.'],
  evening: ['Evening scroll. Perfect time for chai.'],

  countdownFar: ['{days} days to go. Mark it before you forget.'],
  countdownNear: [
    'Only {days} days left. Have you registered yet?',
    '{days} days. It’s getting real.',
  ],
  countdownTomorrow: [
    'It’s TOMORROW. Iron your clothes.',
    'Tomorrow! Sleep early tonight. (You won’t.)',
  ],
  eventDay: [
    'It’s today! Why are you on your phone? Go!',
    'Today’s the day. See you in the auditorium.',
  ],
  afterEvent: [
    'It’s over, but you’re still here. We miss it too.',
    'Chai Connect is done. You can let go now. Or not.',
  ],

  fastScroll: [
    'Woah. Slow down, we’re not going anywhere.',
    'Speed reading? Impressive. Suspicious, but impressive.',
    'You scrolled past all of that in a second. Rude.',
    'Aram se! Itni jaldi kya hai?',
    'That was fast. Did you even look at the countdown?',
  ],
  bottomReached: [
    'You reached the bottom. Most people don’t.',
    'End of the page. You actually scrolled all the way.',
  ],
  backToTop: [
    'Back to the top. Forgot something?',
    'Up and down, up and down. Looking for something?',
  ],
  idle: [
    'Still there? Chai thandi ho rahi hai.',
    'You’ve gone quiet. Thinking about which game to join?',
    'Psst. You can tap things, you know.',
    'Lost in thought, or lost on the page?',
  ],
  returnedToTab: [
    'Welcome back. That was a long {secs} seconds.',
    'You left for {mins} minutes. I counted.',
    'Back from WhatsApp? Tell them to register too.',
  ],
  longStay: [
    '{mins} minutes on this page. That’s longer than most lectures hold you.',
    'You’ve been here {mins} minutes. Should we be worried?',
  ],

  batteryLow: [
    '{pct}% battery? Register before it dies.',
    'Your phone is at {pct}%. Priorities: charger, then Chai Connect.',
  ],
  charging: ['Charging and browsing. Efficient.'],
  offline: ['You just went offline. I’ll wait.'],
  online: ['And we’re back online. Missed you.'],
  landscape: ['Landscape mode? Bold choice.', 'Sideways. Okay. It still works, I promise.'],
  darkMode: ['Your phone is in dark mode. We went pink anyway.'],
  copied: [
    'Copying our homework? Go ahead.',
    'Copied. Share it with your friends while you’re at it.',
  ],
  rageTap: [
    'Easy there. It’s a website, not a doorbell.',
    'Tapping harder won’t make it faster. I checked.',
  ],
  menuLover: ['You really like that menu.', 'Opened the menu again. Can’t decide?'],

  pagePrivacy: ['Someone actually reads privacy pages. Respect.'],
  pageNotFound: ['This page doesn’t exist. Neither does my patience for broken links.'],
  pageAskFirst: [
    'Go on. Nobody will know it was you.',
    'The best question is the one you’re scared to ask.',
  ],
  pageCvFirst: ['Recruiters are going to read this. No pressure.', 'One page is enough. Trust us.'],
  pageGamesFirst: [
    'Choose wisely. You only get one of each.',
    'Hide & Seek or Skill Issues? Big decision.',
  ],
  askDraft: [
    'You started a question last time: “{snippet}”. Finish it?',
    'Your unfinished question is still here: “{snippet}”',
  ],

  doneAsk: [
    'Sent. Now try not to refresh the big screen every 5 seconds.',
    'Brave. Your question is in the queue.',
  ],
  doneCv: ['CV dropped. Somewhere, a recruiter just sat up straighter.'],
  doneGames: [
    'You’re in. Now you actually have to show up.',
    'Registered! Start practising your hiding spots.',
  ],
  // The pet's own moments.
  petted: ['Hehe. Again.', 'That tickles!', 'Best human.', 'Warm hands. Like chai.'],
  pettedTooMuch: ['Okay okay, enough. I’ll spill.', 'Personal space! I’m full of hot chai!'],
  pickedUp: ['Woah, put me down!', 'Careful, I’m full!', 'Wheee… wait, where are we going?'],
  thrown: ['Did you just THROW me?', 'Ow. Rude.', 'I’m seeing stars. Pink ones.'],
  landedSoft: ['Nailed the landing.', 'Ten out of ten.'],
  fellOff: ['Woah! My ledge left!', 'Hey, the floor moved!'],
  wokeUp: ['Five more minutes…', 'I wasn’t sleeping. I was resting my eyes.'],
  suggestHome: [
    'Psst. The games are further down. Go have a look.',
    'Have you asked your question yet? Nobody will know it was you.',
    'Scroll down. The good stuff is down there.',
  ],
  suggestAsk: ['Just type it. I won’t read it. Okay, I might.'],
  suggestCv: ['A one-page PDF is perfect. Don’t overthink it.'],
  suggestGames: ['Pick one physical and one minigame. Or just one. No pressure.'],
  nightYawn: [
    '*yawn* It’s late. The whole site is getting sleepy.',
    'It’s so late even the page dimmed. Go to bed.',
  ],
  // The pet's own life.
  reading: ['Reading “{text}”. Good stuff.', 'Hmm. “{text}”. Deep.', '“{text}”. I’d click that.'],
  refillGo: ['Running low. Kettle time.', 'My chai’s almost gone. Brb.'],
  refillDone: ['Ahh. Fresh chai. Full power.', 'Refilled. Kadak.'],
  outOfChai: [
    'I’m out of chai… the kettle is at the top. Take me home?',
    'Empty glass. Scroll up so I can reach the kettle?',
  ],
  comeHere: ['Hey! Over here!', 'You’ve been ignoring me. Hi.', 'Psst. Remember me?'],
  dodge: ['Nope! Not again!', 'Last time you threw me. I remember.'],
  trustUp: ['Okay, I like you now.'],
  morningStretch: ['Morning stretch. Let’s go.'],
  chaiTime: ['It’s chai time. Literally always, but especially now.'],
  dance: ['♪ chai chai chai ♪', 'Feeling good. Dance break.'],
  bored: ['Bored. Somebody do something.', 'Nothing’s happening. I’ll go explore.'],
  playDots: ['These dots are so fun to kick.', 'Look what I can do to the title!'],
  sleepSpot: ['My favourite spot. Nap time.'],
  othersHere: ['Someone else is reading this too. Hi, stranger!', 'Ooh, company. *waves*'],
  teeter: ['Whoa whoa whoa…', 'Too close to the edge!', 'Okay. Not falling. Totally fine.'],
  hangDrop: ['Geronimo!', 'Hold on… letting go!', 'Bombs away!'],
  climbing: ['Climbing. Don’t watch.', 'Hand over hand. Just like the movies.', 'Almost… there…'],
  mantled: ['Made it.', 'And up! Nailed it.'],
  perch: ['Nice view from up here.', 'Sitting on the edge. Living dangerously.'],
  balanceScroll: ['Easy with the scrolling!', 'Earthquake! Hold on!'],
  scratch: ['Hmm.', 'Where was I going?'],
  // Games page: Chaiman.
  heroIntro: [
    'Suited up. On this page, I’m Chaiman.',
    'The games need a hero. Chaiman reporting.',
    'Cape on. Cowl on. Chai… still on.',
  ],
  grapple: ['Grapple!', 'Thwip. Wait, wrong hero.', 'Zip line, engaged.'],
  glide: ['Cape glide!', 'Wheee… I mean, vigilantly descending.'],
  rang: ['Chairang!', 'It always comes back. Like chai cravings.'],
  signal: ['Someone lit the Chai-signal.', 'The signal’s up. A game needs players.'],
  heroBrood: ['Every game needs a player. Pick one.', 'I patrol these games so you don’t have to.'],
  // More personality.
  musing: [
    'Do you think the other tabs have pets too?',
    'If I’m a chai glass, who drinks me? Don’t answer that.',
    'I wonder what the big screen is showing right now.',
    'Every heading here is a little hill to me.',
    'Fun fact: I am 62% chai and 38% attitude.',
    'Cutting chai: half the cup, double the confidence.',
    'Somebody should ask about internships. Hint hint.',
    'I like this page. It has good ledges.',
    'Rain + chai + pakoras. That’s the dream.',
    'The countdown is my favourite thing to watch.',
  ],
  joke: [
    'Why did the chai go to school? To get a little more cultured.',
    'I’d tell you a tea pun, but it’s not my cup of… wait.',
    'What do you call a sad chai? A cup of oolong face.',
    'I’m not short. I’m a cutting chai.',
    'Chai or coffee? Wrong question. Chai.',
  ],
  shyFirst: ['Oh! Hi. I didn’t see you there.', 'You’re… looking at me. Hi.'],
  scaredLine: ['That was too high!', 'My chai nearly jumped out of me!', 'Ground! Sweet ground!'],
  proudLine: [
    'Did you see that? Flawless.',
    'Pro moves only.',
    'I should be in the games, honestly.',
  ],
  sillyLine: ['Blehhh.', 'Wiggle wiggle.', 'I have zero thoughts and it’s great.'],
  scrollFling: ['Woah! You launched me!', 'Scroll catapult! Again!', 'Wheee!'],
  stuck: ['Hmm, can’t get there. New plan.', 'Okay, that way doesn’t work.'],
  secretBack: [
    'Still thinking about your dot face?',
    'So. You found the sticker secret. Don’t tell everyone.',
  ],
};

export type LineGroup = keyof typeof LINES;
