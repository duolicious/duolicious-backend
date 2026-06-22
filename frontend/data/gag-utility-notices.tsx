const gagMaintenanceNotices = [
  "We’re down for maintenance. If we’re not back in 15 minutes, avenge our death.",
  "We’ve summoned our tech wizards to cast a spell. If you’re still seeing this in 15 minutes, grab your wand and help us out!",
  "Our hamsters needed a break from running wheel. Give us a few, or consider sending more hamsters!",
  "We’re giving our pixels a little pep talk. If they’re not back in line in 15 minutes, they might be staging a digital protest. Send snacks?",
  "Our code monkeys are currently wrestling with a stubborn bug. If we’re not back soon, they might have joined the circus.",
  "Spa day in progress. If we’re not glowing and refreshed in 15 minutes, send cucumber slices!",
  "Duolicious is on a coffee break. If it takes longer than 15 minutes, it’s probably gone for a second cup. Brew with us?",
  "Be right back! We’re currently teaching our servers to sing. If you don’t hear a chorus in 15 minutes, send sheet music.",
  "We sent Duolicious on a quest for the ultimate update. If it’s not back in 15 minutes, it might be fighting a dragon. Cheer us on!",
  "Our app’s having a quick existential crisis. If it’s not back in 15 minutes, it’s pondering the meaning of life (and code).",
  "We’re currently untangling the Web. If you’re still stuck in this net in 15 minutes, send scissors!",
  "We’re diving deep into the digital ocean to fish for better bytes. If we don’t resurface in 15 minutes, send a lifeboat!",
  "Our digital garden is under renovation. If we’re not blooming in 15 minutes, we might’ve forgotten to water the pixels.",
  "Currently traveling through cyberspace. If we’re not back in 15 minutes, we probably took a detour at the digital Milky Way.",
  "We sent our bytes on a retreat to find their bits. If they’re not back harmoniously in 15 minutes, they might be meditating too deeply.",
  "We told Duolicious to take a power nap. If it’s snoring for more than 15 minutes, nudge us gently!",
  "We threw Duolicious a surprise party. If it’s still surprised in 15 minutes, bring cake!",
  "Currently helping our pixels learn the cha-cha. If they haven’t mastered it in 15 minutes, dance with us!",
];

const gagUpdateNotices = [
  "Your app’s fashion is so last season. Time for a wardrobe update!",
  "Did you hear? We’ve leveled up! Upgrade your app to join the party.",
  "This version of the app is like 2021 memes – outdated. Time for an update!",
  "Your app’s feeling a tad vintage today. Give it a modern twist with an update!",
  "Missing out on the new app features is like skipping dessert. Why would you?",
  "Our app fairies have sprinkled some magic. Catch it with an update!",
  "Hey there, time traveler! Hop back to the future with our latest update.",
  "The app’s been to the gym and is now buffer, faster, and stronger. Check out its gains with an update!",
  "We added some sparkles, fixed the wobbles, and jazzed up the jiggles. Time for a fresh coat with an update!",
];

const randomGagMaintenanceNotice = () =>
  gagMaintenanceNotices[Math.floor(Math.random() * gagMaintenanceNotices.length)];

const randomGagUpdateNotice = () =>
  gagUpdateNotices[Math.floor(Math.random() * gagUpdateNotices.length)];

export {
  randomGagMaintenanceNotice,
  randomGagUpdateNotice,
};
