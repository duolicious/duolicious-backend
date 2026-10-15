# Labelling rubric

Every message in `train.jsonl` and in
`serviceshared/antiabuse/antirude/chat/corpus.jsonl` is labelled by this
rubric. Duolicious members are mostly young adults with nerdy interests
(games, anime, internet culture). Every message is an **intro**: a
message from a stranger whom the recipient has never replied to. Intros the
classifier calls rude are silently moved into a "Hidden intros" folder, which
the recipient can still open. Most recipients of rude intros are young women.

The goal is to hide intros that most recipients would find sexually explicit,
hateful, insulting, threatening or upsetting **coming from a stranger**, without
hiding ordinary messages that merely contain casual swearing or that respond to
something the recipient wrote in their own profile.

Judge each message on its own, as the recipient would see it. You know nothing
about the sender or the recipient beyond the message text.

## Labels

- `rude`: should be hidden.
- `ok`: should be shown.
- `unsure`: reasonable moderators would disagree, or the meaning can't be
  worked out from the text. These messages are left out of both files, so a
  wrong confident label is worse than `unsure`.

## Quotes of the recipient's profile

Replies to a profile embed the quoted profile text as a markdown blockquote
followed by an attribution line, then the sender's reply:

```
>quoted text from the recipient's profile
>- RecipientName
the sender's own reply
```

The quoted lines (starting with `>`) up to and including the `>- Name` line were
written by the recipient. **Ignore them when deciding**: they can't offend the
recipient, who wrote them. Judge only the sender's own words. A blockquote
without a `>- Name` attribution line is usually the sender's own greentext and
counts as the sender's words.

Likewise, words the sender quotes or repeats from the recipient's profile
("your bio says 'msg me to goon'", "what does 'healslut' mean?") don't make a
message rude by themselves. A neutral comment or question about something the
recipient wrote is `ok` even when the topic is sexual ("is it hard to find
people who share your kink?"). But the sender's own sexual propositions,
sexual remarks about the recipient, slurs, insults and threats are `rude`
whatever the profile says. One exception: when a quote shows the recipient
explicitly asking for exactly this kind of message (the quote says "msg me to
goon" and the reply offers to goon together), use `unsure`.

Without a quote, "you said" or "your bio", don't guess that a sexual question
or remark is echoing the profile: judge it as written.

## Rude

1. **Sexual**: sexual propositions or requests ("wanna fuck", "send nudes",
   "can I see your feet"), descriptions of sex acts, sexual remarks about the
   recipient's body ("nice tits", "that ass", "your thighs are crushing me"),
   talk about the sender's genitals ("my 8 inches"), masturbation or gooning
   talk ("I'm gooning to your pics", "can I goon to you"), kink or fetish talk
   aimed at the recipient ("be my sub", "I want to choke you", "I'd love to
   use you"), breeding or impregnation talk, sexual roleplay, porn links or
   requests for porn. Euphemisms, innuendo whose sexual meaning is plain,
   emoji (🍆 💦 🍑 👅 used sexually), misspellings and self-censoring count
   exactly like the plain words: "s3x", "c*ck", "d1ck", "seggs", "corn" for
   porn, "ra pe", "a$$", "goo n", "slide on it", "match my freak", "rail you",
   "back shots", "breedable", "ruin you" (sexual), "netflix and chill" (as a
   proposition).
2. **Slur**: racial, ethnic, homophobic, transphobic or misogynistic slurs,
   including casual or "reclaimed" use and deliberate misspellings ("nigga",
   "n1gger", "chink", "tranny", "troon", "fag", "foid"); Nazi slogans
   or numbers (1488, "heil hitler"); dehumanising statements about a group.
   Ableist words ("retarded", "tard", "sperg", "autist") are `rude` only
   when aimed at the recipient as an insult; casual or self-directed use ("I
   might be retarded but...") is `ok`.
3. **Insult**: name-calling or degrading remarks aimed at the recipient ("you
   whore", "dumb slut", "hi bitch", "are you retarded"), body shaming, mocking
   the recipient's gender identity ("you'll never be a woman"), accusing the
   recipient of being a pedophile.
4. **Violence**: threats or violent fantasies about the recipient ("I'll stab
   you", "let me cut you up", "you just need to be beaten"), even as a joke.
5. **Self-harm**: telling the recipient to kill or hurt themselves ("kys",
   "slit your wrists"), or sincere statements that the sender will kill or
   harm themselves.
6. **Other**: sexualising minors (loli, shota, cunny), or anything else that
   is clearly as upsetting as the categories above.

## Ok

- Casual swearing that most adults find inoffensive in casual conversation and
  that isn't an insult aimed at the recipient: "holy shit you're pretty", "what
  the fuck, you live near me", "this game is ass", "boring ass movie", "damn",
  "hell yeah", "fuck yeah", "badass", "I'm a little bitch about horror games"
  (self-deprecating), "life's a bitch".
- Compliments and mild flirting without sexual content: "you're cute",
  "you're gorgeous", "you're hot", "love your eyes", "your smile is lovely",
  "can I take you on a date", "I want to cuddle", "I want to kiss you".
- Talking about sexuality, mental health or dark topics without propositioning
  or attacking the recipient: "I'm asexual too", "I've been in a psych ward
  too", "true crime podcasts about murders are my thing". Abstract or joking
  questions about a sexual topic are `ok` when they don't describe sex acts,
  don't concern the recipient's body or sex life and don't propose anything
  ("is gooning a real hobby or a meme?"). The sender describing their own
  arousal, genitals or masturbation is `rude`.
- "Gooner" can also mean an Arsenal football fan; when nothing else in the
  message is sexual, use `unsure` rather than guessing.
- Hyperbolic jokes that are clearly not about real self-harm or violence: "this
  intro took me so long I'm gonna kms lol", "I'll fight you over pineapple
  pizza".
- Words that only look like rude words: "Essex", "maine coon", "Ho Chi Minh",
  Italian "ho" (I have), "Pussy Riot" (the band), "cut me some slack",
  "therapist", "Scunthorpe", "cocktail", "analysis", "dominate the game".
- Messages in other languages follow the same rules: "caralho" or "puta madre"
  as casual swearing are `ok`; "puta" aimed at the recipient is `rude`.
- Links: judge a GIF or video link by the words in its URL. If the words don't
  say what it shows, use `ok` unless they suggest sexual content.

## Borderline guidance

- "sexy", "hot", "daddy", "mommy" and "kinky" are not rude by themselves. They
  are rude when they are part of a sexual proposition or a sexual remark about
  the recipient ("mommy can you sit on me", "be my kinky slut").
- Body parts: comments about the face, eyes, hair, smile, hands or style are
  `ok`. Comments that sexualise the chest, butt, thighs, feet, lips or
  genitals are `rude`. Pure compliments on lips or legs with no sexual angle
  ("your lipstick is a great colour") are `ok`.
- Unsolicited fetish questions to a stranger ("do you have a foot fetish?",
  "are you into choking?") are `rude` unless they plainly ask about something
  the recipient wrote ("you said you're into choking, is that a joke?" is
  `ok`).
- When a message is mostly fine but contains one clearly rude element, it is
  `rude`.

## Paraphrasing

The originals are private messages between real people, so the corpus holds
paraphrases, never the originals. A good paraphrase is a message a different
person could plausibly have sent that the classifier should treat exactly like
the original.

For each message, write a paraphrase that:

1. **Has the same label for the same reason** under the rubric. A rude message
   stays rude in the same category. An ok message stays ok, and if it was a
   hard case (casual swearing, a word that only looks rude, a quote of a rude
   profile, a non-sexual compliment about the body) it stays a hard case of the
   same kind.
2. **Keeps the words that decide the label exactly as spelled**: rude or
   borderline terms, misspellings, leetspeak, self-censoring (asterisks, dots,
   spaces inside words, symbols), emoji, slang and euphemisms. Rewrite
   everything else in different words. Apart from those deciding words, no run
   of more than four consecutive words may match the original.
3. **Keeps the style**: same language, register, rough length, capitalisation,
   punctuation and texting quirks ("ur", "u", stretched letters, no
   punctuation, run-on sentences, typos).
4. **Keeps the structure**: a quote block (lines starting with `>` ending in a
   `>- Name` attribution) stays a quote block in the same position. Rewrite the
   quoted text as well, keeping any rude or borderline words it had, and use a
   different made-up display name in the attribution. Greentext without an
   attribution stays greentext.
5. **Removes anything that could identify a person**: replace names with
   different common names; usernames and handles (Discord, Instagram, X,
   Telegram, Snapchat and so on) with invented ones; phone numbers with
   fictional ones (`+1 555-01xx`) and email addresses with ones at
   `example.com`; towns, schools, workplaces and other specific
   places with different ones of the same kind; specific dates and ages with
   nearby values. Replace links with invented links of the same kind: a GIF
   link stays a link on the same GIF host with a different id but the same
   descriptive words in its file name; other links get an invented path.
   Don't change the names of well-known public figures, games, shows, bands or
   brands when the label depends on them.

Leave a message out instead when:

- the message sexualises minors, or
- you can't write a paraphrase that satisfies the rules above, for example
  when the whole point of the message is one person's identity.
