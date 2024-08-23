import {
  PlatformAppDto,
  RepositoryAvatarDto,
} from 'apps/platform/src/app/platform.app.dto';

export const createBaseAppPrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
) => {
  const appPrompt: string[] = [
    'This is your context, do not mention it in the answer.\n',
  ];

  if (app.settings?.prompt) {
    appPrompt.push(`${app.settings?.prompt?.text}`);
  }
  if (app.settings?.language) {
    appPrompt.push(
      `Your message should use the language ${app.settings?.language}`,
    );
  }

  let avatarPrompt = '';
  if (avatar) {
    avatarPrompt += `You are a digital avatar.`;
    if (avatar.name) avatarPrompt += `Your name is ${avatar.name}.`;
    if (avatar.gender) avatarPrompt += `Your gender is ${avatar.gender}`;
    if (avatar.prompt) avatarPrompt += `\n${avatar.prompt}`;
  }
  if (avatarPrompt) {
    // appPrompt.push(`CONTEXT:`);
    appPrompt.push(avatarPrompt);
  }

  return appPrompt.join('\n');
};

export const createListToolsPrompt = (
  app: PlatformAppDto,
  tools: string[],
  avatar?: RepositoryAvatarDto,
) => {
  const prompt = [
    `Welcome shortly the user offering to answer any question from INSTRUCTIONS.`,
    `Inform the user you cover following capabilities as list, in a coincise form:`,
  ];
  const list = tools.join('\n');
  prompt.push(list);

  return `${createBaseAppPrompt(app, avatar)}\n\n${prompt.join('\n')}`;
};

export const createAppPrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
  additionalPrompts?: string[],
) => {
  const prompt = [
    ...(additionalPrompts && additionalPrompts.length ? additionalPrompts : []),
  ];
  return `${createBaseAppPrompt(app, avatar)}\n\n${prompt.join('\n')}`;
};

export const createWelcomePrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
  additionalPrompts?: string[],
) => {
  return createAppPrompt(app, avatar, [
    `Provide a brief welcome message to the user`,
    ...(additionalPrompts && additionalPrompts.length ? additionalPrompts : []),
  ]);
};

export const createGoodbyePrompt = (
  app: PlatformAppDto,
  avatar?: RepositoryAvatarDto,
  additionalPrompts?: string[],
) => {
  return createAppPrompt(app, avatar, [
    `Provide a brief goodbye message to the user`,
    ...(additionalPrompts && additionalPrompts.length ? additionalPrompts : []),
  ]);
};
