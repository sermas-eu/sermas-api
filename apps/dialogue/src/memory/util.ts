import { DialogueMemoryMessageDto } from './dialogue.memory.dto';

export const conversationToText = (
  history: DialogueMemoryMessageDto[],
  singleLine = false,
) => {
  return conversationToList(history, singleLine).join('\n');
};

export const conversationToList = (
  history: DialogueMemoryMessageDto[],
  singleLine = false,
) => {
  if (!history || !history.length) return [];
  return history
    .filter((h) => h.type === 'message')
    .map((h) =>
      singleLine
        ? `${h.role.toUpperCase()}: ${h.content.replace(/\n|\t|\r/gm, ' ')}`
        : `- ${h.role}: ${h.content}`,
    );
};
