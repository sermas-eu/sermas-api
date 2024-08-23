export const KEYCLOACK_TEST_REALM = 'sermas-test';

export const sleep = (t: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), t);
  });
