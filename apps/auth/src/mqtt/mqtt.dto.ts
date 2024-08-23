// sub -> acc: '4'
// pub -> acc: '1'
// payload { acc: '1', clientid: 'mqttjs_2ff2ab6f', topic: 'foo/raw' }

export enum MqttAclAcc {
  NONE = '0',
  READ = '1',
  WRITE = '2',
  SUBSCRIBE = '4',
}

export interface MqttAclPayload {
  acc: MqttAclAcc;
  clientid: string;
  topic: string;
}

// export const MqttAclAccKeycloakMapping = {
//   0: 'none',
//   1: 'read',
//   2: 'write',
//   4: 'subscribe',
// };
