# Overheard speech and noisy rooms

A kiosk microphone hears more than the visitor: people talking nearby, remarks about
the avatar, room noise. This page describes how the API keeps the avatar quiet about
speech that is not meant for it, and when it suggests typing instead.

## Before speech-to-text

A voice clip shorter than `STT_MIN_DURATION_MS` (default 250 ms) or quieter than
`STT_MIN_RMS_DBFS` (default -55 dBFS) is dropped without calling speech-to-text, which
tends to invent a phrase out of room noise. A clip whose text is empty, or whose speaker
is not the expected one (speaker verification), is dropped too. Each of these is a
*hearing failure*.

A clip in the avatar's own voice (its speech coming back through the microphone,
recognised by speaker verification against the avatar's recent speech) is dropped
too, but it is **not** a hearing failure: it counts toward nothing below, and the
client gets a plain `stt` `ended` progress event, not a "didn't catch that".

The API logs one `TURN` line per voice clip at debug level: the outcome (accepted, or
dropped and why), the clip's duration and level, and the transcribed text. These are
the numbers to tune the thresholds on a real kiosk.

### The voice signature

Speaker verification (`SPEAKER_VERIFICATION`, on by default) learns the visitor's voice
from the session's first clips, and drops later clips of another voice. It learns only
from clips that were transcribed and accepted, so noise and chatter do not shape it.
After `SPEAKER_RESET_AFTER_DROPS` hearing failures in a row (default 2; 0 never resets),
the API forgets the signature: the next clip is accepted and the voice is learnt again.
A room that turned noisy, or a signature learnt from a bystander, would otherwise lock
the visitor out for the rest of the session. An accepted turn starts the count again.

## The chat filter

Every message that reaches the chat goes through a filter, decided by the LLM in the
same request as the answer. The filter skips a message when it is not addressed to the
avatar:

- an incomplete phrase, like one cut out of background noise;
- self-talk, or chatter with someone else;
- a remark about the avatar in the third person, or to another person ("look, it
  answers", "come on, let's go").

It does not skip a request or question that could be addressed to the avatar, an answer
to the avatar's last question, a greeting, thanks or a goodbye, or a short reply (yes,
no, ok) right after the avatar spoke.

**A skipped message gets no reply.** The avatar says nothing; the API reports the turn
as dropped (a `dialogue/progress` event with `event: llm`, `status: error`,
`error: skipped`), and the kiosk shows a short "didn't catch that" notice and listens
again. A visitor who was really talking to the avatar sees the notice and can repeat or
type.

## Talking over the avatar

While the avatar speaks, the microphone hears it too. Echo cancellation in the browser
removes part of it, how much depends on the device, so the web toolkit adds its own
guard (barge-in):

- a stretch of speech that overlaps the avatar's voice, or starts within half a second
  after it, is sent only if it holds about 700 ms of confident speech; anything shorter
  is the avatar's echo or noise, and is dropped on the device;
- when it does, the visitor is talking over the avatar: the avatar's voice is lowered,
  not paused, and the clip goes to the API as a normal turn;
- the API answers `dialogue/stop` when the turn is accepted (the avatar stops, the new
  answer follows) and `dialogue/continue` when it is dropped or skipped (the avatar's
  voice comes back). Without either within 6 seconds the client restores it on its own.

The toolkit sends each turn as one WAV clip on `dialogue/user-speech/:sessionId/:chunkId`.
The API still accepts frames on `dialogue/user-speech/stream/...` from older clients and
appends them in arrival order.

## The kiosk's reaction

The SERMAS kiosk shows the dots beside the visitor only while they speak (not for
background noise), and ends them when the turn is answered or dropped. After two hearing
failures in a row the avatar plays its *don't know* gesture, once: not again until the
visitor's next turn gets through. Skipped messages do not count.

## The noisy-room suggestion

When hearing failures pile up, the room is probably too noisy for the microphone. After
`DIALOGUE_NOISY_THRESHOLD` hearing failures (default 3) within
`DIALOGUE_NOISY_WINDOW_SEC` seconds (default 60), the avatar says one short line, in the
session language, suggesting the on-screen keyboard, and the API sends a
`dialogue/progress` event with `error: noisy` so the client can open its keyboard. It
says it once: while failures keep coming and no turn is answered (often there is
nobody at the kiosk, only background noise), it stays silent. An answered turn starts
the count again, and the line can then come back, but not sooner than
`DIALOGUE_NOISY_COOLDOWN_SEC` seconds (default 120) after the last one. `DIALOGUE_NOISY_THRESHOLD=0` disables
the suggestion.

Messages the filter skipped do not count: the microphone heard them clearly, they were
just not meant for the avatar, and the keyboard would not help.
