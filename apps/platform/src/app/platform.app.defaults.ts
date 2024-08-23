import {
  AppModuleConfigDto,
  RepositoryAvatarDto,
  RepositoryBackgroundDto,
  RepositoryConfigDto,
} from './platform.app.dto';

export const ModuleRobot: AppModuleConfigDto = {
  moduleId: 'robot',
  supports: ['robotics', 'detection'],
};
export const ModuleAvatar: AppModuleConfigDto = {
  moduleId: 'avatar',
  supports: ['dialogue', 'detection', 'ui', 'session', 'platform'],
};

export const RepositoryAvatarDefault: RepositoryAvatarDto = {
  id: 'default',
  type: 'avatars',
  name: 'Joy',
  modelType: 'readyplayerme',
  gender: 'F',
  path: 'https://models.readyplayer.me/654cc759f1a79ed2ebab0207.glb',
  prompt:
    'You are a digital avatar and your role is to be an helpful assistant',
};

export const RepositoryBackgroundDefault: RepositoryBackgroundDto = {
  id: 'default',
  type: 'backgrounds',
  name: 'default',
  path: 'default',
};

export const RepositoryDefaults: RepositoryConfigDto = {
  avatars: [RepositoryAvatarDefault],
  backgrounds: [RepositoryBackgroundDefault],
  robots: [],
  documents: [],
  animations: [],
};
