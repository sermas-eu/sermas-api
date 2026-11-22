import {
  AppModuleConfigDto,
  RepositoryAvatarDto,
  RepositoryBackgroundDto,
  RepositoryConfigDto,
} from './platform.app.dto.js';

export const ModuleRobot: AppModuleConfigDto = {
  moduleId: 'robot',
  supports: ['robotics', 'detection'],
};
export const ModuleAvatar: AppModuleConfigDto = {
  moduleId: 'avatar',
  supports: ['dialogue', 'detection', 'ui', 'session', 'platform'],
};

// Pip, the robot the kiosk ships at /avatars/pip.glb (sermas-eu/sermas-avatar-pip). A
// path starting with "/" is loaded from the kiosk's own origin; cameras are framed for
// Pip. modelType only selects the bone names (Head, LeftEye, RightEye) its rig uses.
export const RepositoryAvatarDefault: RepositoryAvatarDto = {
  id: 'default',
  type: 'avatars',
  name: 'Pip',
  modelType: 'readyplayerme',
  gender: 'F',
  path: '/avatars/pip.glb',
  camera: {
    position: { x: -0.0001, y: 0.278, z: 1.664 },
    rotation: { x: -0.1235, y: 0, z: 0 },
  },
  cameraMobile: {
    position: { x: -0.0001, y: 0.168, z: 2.464 },
    rotation: { x: -0.1107, y: 0, z: 0 },
  },
  prompt:
    'You are Pip, a small friendly robot assistant. Keep answers short and clear.',
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
