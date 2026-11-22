# UI interactions: buttons and quizzes

The avatar can show interactive content: a block of buttons (the welcome menu, the
choices of a task field) or a quiz. This page describes what happens when a visitor
clicks one.

## How a click is matched

When the API shows a `buttons` or `quiz` content in a session, it registers one *UI
tool* per button or answer, for that session. The kiosk publishes each click on
`app/<appId>/ui/interaction/<moduleId>`, and the API matches it to a UI tool:

| Content | Matched by |
|---|---|
| `buttons` | the button's `value` |
| `quiz` | the answer's `answerId` |

The label is not used for matching. It is added to the conversation as the user's
message, so the chat history reads as if the visitor had said it.

## A block works once

All the UI tools of one content belong to the same block, and the block is single use:
after the first click the API removes the UI tools of every button in it. A client must
not let a visitor click the same block twice. The SERMAS kiosk hides a used block of
buttons, and for a quiz keeps the question with only the chosen answer, disabled.

A visitor who wants another option asks for it, by voice or by typing, and the avatar
shows the content again.

## What a click does

A UI tool does nothing by itself. What happens depends on the content:

- **Welcome menu.** It lists the application's tools and tasks, except those with
  `options.list: false` (on a tool or a task), which stay usable
  from the conversation. A tool's `label` is the button text, translated to the session
  language but not rephrased; without a `label`, the LLM rephrases the tool's
  `description` into one, differently at each session. Each button's `value` is
  `tool/<name>`, `ask/<name>` or `task/<taskId>`: the click triggers that application
  tool, asks a question, or starts that task. A tool with `options.ask: true` is a
  **question button**: its label, as shown, is sent as the visitor's message and the
  avatar answers it from the application's documents; such a tool is not offered to the
  chat as a tool. A tool that shows UI content
  (an image, a link) also gets one short spoken line about what is now on the screen:
  the LLM writes it in the session language from the content's own words (its
  `description`, `label`, `alt`, `url`), and for a link points at the QR code the
  SERMAS kiosk shows. A tool with `skipResponse: true` (a quiz) shows its content
  without a line. If the LLM call fails, a fixed line is said instead (translated to
  the session language).
- **Asked in conversation.** When the chat matches a tool that shows content, the content
  never replaces the answer: the avatar answers the question, then says one short
  sentence about what is now on the screen, from the same words (for a link, the QR
  code). The chat sees each tool's `description` and what it shows. A tool that shows a
  link is matched only when the visitor explicitly asks for a website, a link or the
  documentation; a request to explain something is answered in words. A tool just
  shown is not matched again unless the visitor asks for it again. Write a link tool's
  `description` for explicit requests only ("The user asks for the project website or a
  link to it"): a broad one ("more about the project") turns questions into links.
- **Task choices.** The click answers the task's current field, and the task moves on.
- **Quiz answers.** The avatar comments on the answer: the LLM writes one or two short
  sentences, in the session language, saying whether the answer is right and why. It
  uses the quiz `question` and the answer's `correct` and `reason`. If the LLM call
  fails, the avatar says the answer's `reason` instead (translated to the session
  language).

## Writing a quiz

A quiz is shown by a tool with `ui` content of type `quiz`. Write a `reason` for every
answer: it is the substance of the avatar's comment, and its fallback.

```yaml
- name: start-quiz
  description: The user wants a quiz, a game, or to test what they know about SERMAS
  skipResponse: true
  ui:
    contentType: quiz
    content:
      question: How many functional modules does the SERMAS Agent architecture define?
      answers:
        - answerId: four
          answer: Four
          correct: false
          reason: There are more. Detection, Dialogue, Robotics, Security, Session, UI, XR and Platform make eight.
        - answerId: eight
          answer: Eight
          correct: true
          reason: Right. Detection, Dialogue, Robotics, Security, Session, UI, XR and Platform.
```

`answerId` must be unique within the quiz. `skipResponse: true` shows the quiz without a
spoken answer to the request that opened it.
