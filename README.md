# Stride

Zero to twenty minutes a day, one small step at a time.

**Live:** https://orphanheiress.github.io/stride/

## What it is

A habit app built on the psychology of gradual change. You start at one minute
— genuinely trivial — and the session grows by about thirteen seconds a day
until it reaches twenty minutes on day ninety. You never decide anything: open
it, see the session, do it, tap Done.

- **Today** — one card, one button. The timer is the session; the move list is
  what you do inside it.
- **Path** — 90 steps. Finish today → +1 step. Skip → −1 step. The green ring
  ahead and the red ring behind show exactly what today's choice does to
  tomorrow.
- **Settings** — music, motion, reminder, backup. That's all.

## The idea

Motivation is the least reliable lever in behaviour change, so this app doesn't
use it. It uses:

- **The two-minute rule** — day one is one minute. The habit is showing up.
- **A ramp you can't feel** — about 13 seconds more each day.
- **Loss aversion** — the path moves *both* ways. Skipping visibly costs you a
  step, which stings more than gaining one feels good.
- **Never a reset** — one miss costs one step, never the whole path.

## Motion mode

Optional. The camera watches for movement locally — video never leaves the
device. While you move, the music plays and the clock runs; when you stop, both
wait for you. It calibrates itself to your camera and lighting in the first few
seconds of each session.

## Music

Three options, all local:

- **Stride** — a bundled 64-second ambient pad that loops seamlessly. Works
  offline, no setup.
- **My file** — your own audio, stored in the browser.
- **Link** — a YouTube or direct audio URL. (YouTube autoplay is unreliable on
  iOS; the app falls back to the built-in track rather than going silent.)

## Progress

Saved automatically in the browser on the device you use. Use **Copy backup
code** / **Restore** in Settings to move progress between devices. Nothing is
sent to any server — there isn't one.

## Running it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Camera features need `localhost` or HTTPS.

---

Built with Letta Code.
