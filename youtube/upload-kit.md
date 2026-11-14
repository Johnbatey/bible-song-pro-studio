# YouTube upload kit — "Animate Any Verse"

Everything below is written to be pasted straight into YouTube Studio.
Source art: `Bible Song Pro Studio/thumbnail/youtube-1280x720.jpg`.

| | |
|---|---|
| **File** | `/Users/explorer02/Movies/Bible Song Pro Tutorial/Animation in Bible Song Pro Studio.mp4` |
| **Duration** | 2:25 |
| **Resolution** | 1280 × 720, 30 fps |
| **Thumbnail** | `Bible Song Pro Studio/thumbnail/youtube-1280x720.jpg` (126 KB — YouTube's cap is 2 MB) |
| **Category** | Education |
| **Playlist** | Bible Song Pro Studio |
| **Status** | Uploaded, unlisted — awaiting metadata pass |
| **Visibility** | Public (after metadata) |

---

## 1. Title

Pick one. The first matches your own house pattern (`Stop …!` + `| Bible Song Pro Studio`).

```
Stop Static Slides! Animate Any Verse in Bible Song Pro Studio
```

Alternates:

```
Animate Any Bible Verse in Seconds | Bible Song Pro Studio
```

```
Slide Animation Without After Effects | Bible Song Pro Studio
```

Keep under 60 characters if you can — the first is 65 and will truncate on mobile.

---

## 2. Description (copy-paste)

```
Animate any verse in Bible Song Pro Studio — word by word, straight from the slide designer. No After Effects, no PNG sequences, no round trip through Photoshop.

In this tutorial I open the Animation FX panel and show you how to pick a transition, set the timing, and push a verse to Program so it types on while your pastor is still reading it.

TIMESTAMPS
0:00 What we're making
0:20 The Animation FX panel
0:40 Your first verse animates
1:25 Songs, same treatment
1:42 Every transition in the list
2:12 Go transparent for OBS and NDI

Bible Song Pro Studio is free, open-source church presentation software for macOS, Windows and Linux. Live scripture detection, songs, stage display, NDI and broadcast graphics — from one console, one operator.

DOWNLOAD (free, GPL-3.0)
https://www.biblesongpro.app
Source and releases: https://github.com/Johnbatey/bible-song-pro-studio

If it saves your team a Sunday, give the repo a star on GitHub — it genuinely helps.

QUESTIONS
support@biblesongpro.com

Subscribe for more Bible Song Pro Studio tutorials.

#ChurchTech #ChurchMedia #BibleSongProStudio #WorshipTech #ChurchPresentation
```

---

## 3. Tags (copy-paste, comma separated)

```
bible song pro studio, church presentation software, free church presentation software, slide animation, church media, church tech, worship tech, animate slides, church graphics, pro presenter alternative, easy worship alternative, church livestream, how to animate slides, bible software for church, open source church software
```

---

## 4. Settings to set on the upload screen

- **Category:** Education
- **Video language:** English
- **Audience:** "No, it's not made for kids"
- **Altered content:** No (this is a screen recording, not synthetic media)
- **Comments:** On, with **Hold potentially inappropriate comments for review**
- **Playlist:** Bible Song Pro Studio → add at the **top** so it leads the series
- **Thumbnail:** upload `youtube-1280x720.jpg` (do not let YouTube auto-pick a frame)
- **End screen:** subscribe + "next tutorial" element in the last 20 seconds
- **Visibility:** Unlisted until launch day, then flip to Public

About "how to video": YouTube has no separate how-to *category* any more — the old
"Howto & Style" category is deprecated in Studio. **Education** is the correct
home for a software tutorial, and the word "How to" belongs in the title or the
first line of the description, where it also helps search. If you want the
how-to framing, use the third title option above.

---

## 5. Launch-day gotcha

The title, description, tags and thumbnail carry **no version number on purpose** —
that way they stay accurate whichever build ships. Keep it that way; a version in a
thumbnail is a deadline you can miss.

That shifts the whole burden onto the website. `www.biblesongpro.app` is live and is
the right link, but its download buttons currently point at **3.4.0** assets. Before
the video goes public:

1. Publish the new GitHub release
2. Repoint the site's download buttons to it
3. Bump the version badge in the site hero

Otherwise viewers land on a page offering an older build than the one the video
demonstrates — the exact mismatch the video is supposed to be selling against.

---

## 6. What I could not do from here

- **Apply any of it through the API** — every YouTube call now returns
  `403 quotaExceeded`. Reads and writes share one daily quota that resets at
  midnight Pacific. Until then the video ID can't even be looked up (unlisted
  videos aren't returned by public search), so I need the URL from you.
- **Set the custom thumbnail** — `YOUTUBE_UPDATE_THUMBNAIL` takes a public image
  URL, not a file, so a 126 KB JPG sitting on your disk can't be sent. Two
  options: attach it in Studio yourself (four clicks), or tell me and I'll host
  it somewhere public first.
- **Read the other playlist video's description** — blocked by the same quota.
  The chapter block I wrote follows YouTube's rules (starts at 0:00, six
  chapters, every one longer than 10 s) and your own script voice, not that
  video's exact layout. Paste it to me and I'll mirror the house format.

---

## 7. Where the timestamps came from

I sampled the video frame by frame rather than guessing, so each chapter starts on
a visible change:

| Mark | What is on screen |
|---|---|
| 0:00 | Bible tab, Genesis 1 open, Program LIVE still blank/black |
| 0:20 | Animation FX panel open — Transition, Duration 0.8 s, Animate Background, Stage Display FX |
| 0:40 | Verse 2 pushed LIVE, now animating on the red background |
| 1:25 | Songs tab selected (Amazing Grace / Excess Love / How Great Thou Art) |
| 1:42 | Transition dropdown expanded — the full ten-entry list, `Zoom + Type-On (Clip Reveal)` ticked |
| 2:12 | Program switches to a transparent background — the checkerboard view for OBS/NDI keying |

Frame dumps used for this are temporary and were deleted; regenerate with
`ffmpeg -ss <seconds> -i "<video>" -frames:v 1 out.jpg`.

---

## 8. Pre-publish checklist

- [ ] Title pasted, under ~60 characters
- [ ] Description pasted, links checked
- [ ] Tags pasted
- [ ] Category = Education
- [ ] Not made for kids
- [ ] Thumbnail uploaded (not auto-generated)
- [ ] Added to **Bible Song Pro Studio** playlist, positioned first
- [ ] End screen added
- [ ] Watched back once at 1080p for audio sync
- [ ] Visible as Unlisted → spot-check on a phone before going Public
