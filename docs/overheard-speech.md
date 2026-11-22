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

## The noisy-room suggestion

When hearing failures pile up, the room is probably too noisy for the microphone. After
`DIALOGUE_NOISY_THRESHOLD` hearing failures (default 3) within
`DIALOGUE_NOISY_WINDOW_SEC` seconds (default 60), the avatar says one short line, in the
session language, suggesting the on-screen keyboard, and the API sends a
`dialogue/progress` event with `error: noisy` so the client can open its keyboard. It
does so at most once every `DIALOGUE_NOISY_COOLDOWN_SEC` seconds (default 120) per
session. An answered turn starts the count again. `DIALOGUE_NOISY_THRESHOLD=0` disables
the suggestion.

Messages the filter skipped do not count: the microphone heard them clearly, they were
just not meant for the avatar, and the keyboard would not help.
