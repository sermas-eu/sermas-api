import { DialogueTaskDto } from './store/dialogue.tasks.store.dto';

export const convertTaskToPrompt = (
  tasks?: DialogueTaskDto[],
): string | undefined => {
  if (!tasks || !tasks.length) return undefined;
  return JSON.stringify(
    tasks.map((t) => ({
      name: t.name,
      description: t.description,
    })),
  );
};
